#!/usr/bin/env python3
"""
Concatenate Rebirth/web_app_parts/*.js → pwa/static/web_app.js
(Run after editing parts; matches Claudia Core PWA_WEB_APP_SPLIT_PLAN.)
"""
from pathlib import Path

PWA_DIR = Path(__file__).resolve().parent
REBIRTH = PWA_DIR.parent
PARTS_DIR = REBIRTH / "web_app_parts"
OUT = PWA_DIR / "static" / "web_app.js"


def main() -> None:
    if not PARTS_DIR.is_dir():
        print(f"Missing {PARTS_DIR}")
        return
    parts = sorted(PARTS_DIR.glob("*.js"))
    if not parts:
        print(f"No .js files in {PARTS_DIR}")
        return
    OUT.write_text("\n".join(p.read_text(encoding="utf-8") for p in parts), encoding="utf-8")
    print(f"Built {OUT.name} from {len(parts)} part(s).")


if __name__ == "__main__":
    main()
