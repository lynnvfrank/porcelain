#!/usr/bin/env python3
"""
Concatenate web_app_parts/*.js (in filename order) into static_web_app.js.

Part files live in the Porcelain root under web_app_parts/, named so sort order is correct
(e.g. 01_multi_user.js, 02_state_draft.js, ...).
The first part starts with (function(){ and the last ends with })();

Run from anywhere:
  python scripts/build_locus.py
"""

from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PORCELAIN_ROOT = SCRIPT_DIR.parent
PARTS_DIR = PORCELAIN_ROOT / "web_app_parts"
OUTPUT_FILE = PORCELAIN_ROOT / "static_web_app.js"


def main() -> None:
    if not PARTS_DIR.is_dir():
        print("web_app_parts/ not found — edit static_web_app.js directly.")
        return

    parts = sorted(PARTS_DIR.glob("*.js"))
    if not parts:
        print("No .js files in web_app_parts/ — keep editing static_web_app.js.")
        return

    chunks = []
    for p in parts:
        chunks.append(p.read_text(encoding="utf-8"))
    out = "\n".join(chunks)

    OUTPUT_FILE.write_text(out, encoding="utf-8")
    print(f"Built {OUTPUT_FILE.name} from {len(parts)} part(s). Restart the server and refresh the PWA to see changes.")


if __name__ == "__main__":
    main()
