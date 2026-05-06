"""
Claudia Ingest Watcher
Watches transcript conversations and notes directories.
Ingests new/changed files into the Claudia Gateway (Qdrant RAG).

Run:  python D:/Rebirth/ingest_watcher.py
Stop: Ctrl+C

Projects:
  transcripts  -- Moto X conversation .md files  (ask about your day)
  notes        -- D:/Notes/ .md files             (ask about your notes)

State is tracked in D:/Rebirth/ingest_state.json by SHA-256 so only
changed files are re-ingested. Delete the state file to force a full
re-index on next run.
"""
import hashlib
import json
import os
import time
from datetime import datetime
from pathlib import Path

# Load D:\Rebirth\.env if present (gitignored, holds gateway token)
try:
    from dotenv import load_dotenv
    _env = Path(__file__).resolve().parent / ".env"
    if _env.exists():
        load_dotenv(_env)
except ImportError:
    pass

import httpx

# ── Config ───────────────────────────────────────────────────────────────────
GATEWAY_URL   = os.environ.get("CLAUDIA_GATEWAY_URL",   "http://localhost:3000")
GATEWAY_TOKEN = os.environ.get("CLAUDIA_GATEWAY_TOKEN", "claudia-loves-lynn")
STATE_FILE    = Path(os.environ.get("CLAUDIA_INGEST_STATE", r"D:\Rebirth\ingest_state.json"))
POLL_SECONDS  = int(os.environ.get("CLAUDIA_INGEST_POLL", "30"))

WATCH = [
    {
        "path":    Path(r"D:\Rebirth\Moto X\claudia_motoxaudio_data\conversations"),
        "glob":    "conversation_*.md",
        "project": "transcripts",
    },
    {
        "path":    Path(r"D:\Notes"),
        "glob":    "*.md",
        "project": "notes",
    },
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def ts():
    return datetime.now().strftime("%H:%M:%S")


def sha256_of(path: Path) -> str:
    h = hashlib.sha256(path.read_bytes()).hexdigest()
    return f"sha256:{h}"


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_state(state: dict):
    STATE_FILE.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")


def gateway_alive() -> bool:
    try:
        with httpx.Client(timeout=3) as c:
            return c.get(f"{GATEWAY_URL}/health").status_code == 200
    except Exception:
        return False


def ingest_one(client: httpx.Client, path: Path, project: str, content_hash: str) -> bool:
    """POST one file to /v1/ingest. Returns True on success."""
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
        if not text.strip():
            return True  # empty file — skip but don't error
        resp = client.post(
            f"{GATEWAY_URL}/v1/ingest",
            headers={
                "Authorization":    f"Bearer {GATEWAY_TOKEN}",
                "Content-Type":     "application/json",
                "X-Claudia-Project": project,
            },
            json={
                "text":         text,
                "source":       path.name,
                "content_hash": content_hash,
            },
            timeout=90,
        )
        if resp.status_code == 200:
            data = resp.json()
            print(f"[{ts()}]  ✓  {path.name}  →  {data.get('chunks', '?')} chunks  [{project}]")
            return True
        else:
            print(f"[{ts()}]  ✗  {path.name}: HTTP {resp.status_code}  {resp.text[:120]}")
            return False
    except Exception as exc:
        print(f"[{ts()}]  ✗  {path.name}: {exc}")
        return False


# ── Main loop ─────────────────────────────────────────────────────────────────

def scan_once(state: dict) -> tuple[dict, int]:
    """Scan all watch dirs. Returns (updated_state, files_ingested)."""
    ingested = 0
    with httpx.Client() as client:
        for watch in WATCH:
            d: Path = watch["path"]
            if not d.exists():
                continue
            for f in sorted(d.glob(watch["glob"])):
                try:
                    current_hash = sha256_of(f)
                except Exception:
                    continue

                key = f"{watch['project']}/{f.name}"
                if state.get(key) == current_hash:
                    continue  # unchanged

                ok = ingest_one(client, f, watch["project"], current_hash)
                if ok:
                    state[key] = current_hash
                    ingested += 1

    if ingested:
        save_state(state)
    return state, ingested


def main():
    print()
    print("  ✦ Claudia Ingest Watcher")
    print(f"    Gateway : {GATEWAY_URL}")
    print(f"    Poll    : every {POLL_SECONDS}s")
    print(f"    State   : {STATE_FILE}")
    for w in WATCH:
        print(f"    Watch   : {w['path']}  →  project={w['project']}")
    print()

    state = load_state()
    print(f"[{ts()}] Loaded state — {len(state)} files tracked.")

    while True:
        if not gateway_alive():
            print(f"[{ts()}] Gateway not reachable at {GATEWAY_URL} — waiting...")
            time.sleep(POLL_SECONDS)
            continue

        print(f"[{ts()}] Scanning...")
        state, n = scan_once(state)
        if n == 0:
            print(f"[{ts()}] Nothing new.")
        else:
            print(f"[{ts()}] Ingested {n} file(s).")

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nIngest watcher stopped. Goodbye! 🌸")
