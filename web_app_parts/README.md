# PWA web app parts

These scripts are the **original Claudia mobile chat UI** (sidebar, bubbles, fork, avatars). They concatenate into `pwa/static/web_app.js`.

Edit these files; then build:

```bash
python pwa/build_web_app.py
```

Restart `pwa/server.py` and hard-refresh. The shell HTML is generated from Claudia Core’s `mobile_orchestrator_api.py` via `pwa/tools/emit_claudia_web_shell.py` when that template changes.

Order is by filename (`01_` … `12_`). Do not reorder or the app will break.

**Backend:** Chat uses `/conversations`, `/api/auth/*`, `/api/avatar/*`, etc. Those APIs are provided by **Claudia Core** (`Previously Claudia Core/Scripts/mobile_orchestrator_api.py`, typically port **11435**). This Rebirth server serves the **same UI assets** so your edits to `web_app_parts` show up here; for a fully working inbox you still run the orchestrator (or add your own API-compatible backend).

The experimental tabbed app (Gemini/Gateway journal + notes) lives at **`/legacy-app`** on the Rebirth PWA server.
