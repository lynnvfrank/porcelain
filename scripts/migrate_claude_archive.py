#!/usr/bin/env python3
"""
Migrate recovered Claude Code sessions from claude_chat_archive/sessions/*.md
into Locus format (.data/mobile_conversations.json).

Usage:
  python migrate_claude_archive.py          # Preview: show what would be imported
  python migrate_claude_archive.py --confirm  # Actually import into .data/
"""

import json
import re
import sys
import io
from pathlib import Path
from datetime import datetime, timezone

# Fix Windows console encoding for emoji/unicode
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PROJECT_ROOT = Path(__file__).resolve().parent
ARCHIVE_DIR = PROJECT_ROOT / "claude_chat_archive" / "sessions"
STORE_FILE = PROJECT_ROOT / ".data" / "mobile_conversations.json"


def parse_markdown_session(file_path: Path) -> dict | None:
    """Parse claude_chat_archive/sessions/*.md file into Locus conversation format."""
    try:
        with open(file_path, encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        print(f"  ✗ Failed to read {file_path.name}: {e}")
        return None

    # Extract UUID and title from filename
    # Format: "{uuid} - {title} ({uuid}).md"
    match = re.match(
        r"^([a-f0-9\-]+)\s*-\s*(.+?)\s*\(([a-f0-9\-]+)\)\.md$",
        file_path.name
    )

    if not match:
        print(f"  ✗ Could not parse filename: {file_path.name}")
        return None

    uuid = match.group(1).strip()
    title = match.group(2).strip() or "Chat"

    # Parse metadata line: **Meta**: created ... | last ... | cwd ...
    # Format: "created 2026-05-03T20:16:38-05:00 | last 2026-05-05T18:40:50-05:00 | cwd D:\Rebirth"
    meta_match = re.search(
        r"\*\*Meta\*\*:\s*created\s+([\dT\-:+]+)\s*\|\s*last\s+([\dT\-:+]+)",
        content
    )

    created_at = meta_match.group(1).strip() if meta_match else datetime.now(timezone.utc).isoformat()
    updated_at = meta_match.group(2).strip() if meta_match else created_at

    # Parse messages: ## {role} {timestamp}\n{content}
    # Multiple messages until next ## marker or EOF
    messages = []
    msg_pattern = r"^##\s+(user|assistant)\s+([\dT\-:+]+)\s*\n(.*?)(?=^##\s|\Z)"

    for msg_match in re.finditer(msg_pattern, content, re.MULTILINE | re.DOTALL):
        role = msg_match.group(1)
        msg_content = msg_match.group(3).strip()

        if msg_content:
            messages.append({
                "role": role,
                "content": msg_content
            })

    if not messages:
        print(f"  ⚠ No messages found in {file_path.name}")
        return None

    return {
        "id": uuid,
        "owner": "ruby",  # Recovered sessions are all Ruby's
        "title": title,
        "created_at": created_at,
        "updated_at": updated_at,
        "messages": messages,
        "message_count": len(messages),
        "sparkline_data": [],
        "feedback_liked": 0,
        "feedback_noted": 0,
        "pinned": False,
        "important": False,
        "_imported_from": "claude_code_archive",
        "_import_date": datetime.now(timezone.utc).isoformat(),
    }


def load_existing_store() -> dict:
    """Load existing conversation store, or return empty template."""
    if not STORE_FILE.exists():
        return {"conversations": [], "archive": []}

    try:
        with open(STORE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"conversations": [], "archive": []}


def save_store(data: dict) -> None:
    """Save conversation store to disk."""
    STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STORE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"✓ Saved {len(data.get('conversations', []))} conversations to {STORE_FILE}")


def main():
    confirm = "--confirm" in sys.argv

    if not ARCHIVE_DIR.exists():
        print(f"Archive directory not found: {ARCHIVE_DIR}")
        sys.exit(1)

    session_files = sorted(ARCHIVE_DIR.glob("*.md"))
    print(f"\nFound {len(session_files)} session file(s) in {ARCHIVE_DIR.name}/\n")

    # Parse all sessions
    imported = []
    skipped = 0

    for f in session_files:
        conv = parse_markdown_session(f)
        if conv:
            imported.append(conv)
            print(f"  ✓ {conv['title'][:60]:<60} ({len(conv['messages'])} msgs)")
        else:
            skipped += 1

    print(f"\n{len(imported)} sessions parsed, {skipped} skipped\n")

    if not imported:
        print("No sessions to import.")
        return

    # Load existing store and merge
    store = load_existing_store()
    existing_ids = {c.get("id") for c in store.get("conversations", [])}

    # Check for duplicates
    duplicates = sum(1 for c in imported if c["id"] in existing_ids)
    if duplicates:
        print(f"⚠ {duplicates} sessions already in store (skipping duplicates)\n")
        imported = [c for c in imported if c["id"] not in existing_ids]

    if not imported:
        print("Nothing new to import.")
        return

    # Add imported sessions to the front of conversations list
    store["conversations"] = imported + store.get("conversations", [])

    print(f"Ready to import {len(imported)} sessions into {STORE_FILE.relative_to(PROJECT_ROOT)}")

    if not confirm:
        print("\nPreview mode: run with --confirm to actually import")
        print(f"  python migrate_claude_archive.py --confirm")
        return

    # Actually save
    save_store(store)
    print(f"✓ Import complete! {len(imported)} new conversations added.")
    print(f"  Total conversations: {len(store.get('conversations', []))}")


if __name__ == "__main__":
    main()
