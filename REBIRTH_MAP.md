# Rebirth Map

Last updated: 2026-04-29

This is the short orientation map for the Rebirth workspace. Treat it as a quick
landing page, not as a full project plan.

## Current Source Of Truth

- `claudia-gateway/` is the newest gateway/router work from Ruby and Lynn.
  - Current implementation: Go gateway in front of BiFrost.
  - Key docs: `README.md`, `docs/claudia-gateway.plan.md`, `docs/version-v0.2.md`,
    `docs/indexer.md`.
  - Important note: `docs/claudia-gateway.plan.md` preserves the older
    LiteLLM/TypeScript roadmap shape, but the repo now ships Go + BiFrost.
- `Moto X/` is the live phone audio capture experiment.
  - `receiver.py`: Windows PC receiver. Accepts phone audio, filters silence,
    transcribes speech, and saves Markdown.
  - `record.py`: Termux-side reference script to copy onto the Moto X.
- `claudia_motoxaudio_data/` is the intended central Moto X output folder under
  Rebirth.
- `Previously Claudia Core/` is the older, large Claudia system and knowledge
  base. It is still extremely useful, but some plans are stale.
  - Start with `README.md`, `Documentation/AI_ONBOARDING_GUIDE.md`,
    `Documentation/Project/NOW_PLAN.md`, and `Scripts/README.md`.
  - Existing useful lanes: PWA, Keep processing, audio transcription, journal
    database, indexing/search, boards, and old planning docs.
- `web_app_parts/` is a split version of the older PWA frontend JavaScript.
  - Edit these parts, then rebuild `Scripts/static_web_app.js` from the old core
    workflow if using that PWA path.
- `assets/` is a large visual asset bucket.

## Moto X Audio Direction

Goal: use the Moto X as a low-friction audio journal/lifelog sender.

Recommended flow:

1. Moto X records short AAC/M4A chunks in Termux.
2. Moto X posts chunks to the PC receiver over Tailscale or LAN.
3. PC converts each chunk to real 16 kHz mono WAV for VAD.
4. Silero VAD classifies the chunk:
   - speech: keep original audio and transcribe with faster-whisper
   - ambient: keep original audio and create a review note
   - silence: discard audio and write a silence log entry
5. Saved transcripts become ingestible/searchable by Claudia.

Do not record fake `.wav` files on the phone. `termux-microphone-record` supports
encoders such as `aac`, `amr_wb`, and `amr_nb`; PC-side normalization is less
fragile.

Current files:

- `Moto X/receiver.py`
- `Moto X/record.py`
- `claudia_motoxaudio_data/audio/`
- `claudia_motoxaudio_data/transcripts/`
- `claudia_motoxaudio_data/silence_log.md`

Future bridge to gateway:

- Short term: let the file indexer ingest `claudia_motoxaudio_data/transcripts`.
- Later: have the receiver call gateway `POST /v1/ingest` after writing each
  transcript, using the same tenant/project/flavor headers as the rest of
  Claudia memory.

## Keep And Notes

Ruby has many newer project notes in Google Keep, so older docs may miss current
thinking. Existing old-core scripts are still useful:

- `Previously Claudia Core/Scripts/sync_keep_gkeepapi.py`
- `Previously Claudia Core/Scripts/process_keep_notes.py`
- `Previously Claudia Core/Scripts/import_keep_to_board.py`
- `Previously Claudia Core/Scripts/search_index.py`
- `Previously Claudia Core/Scripts/indexing_service.py`

Best next organizational move: pull Keep into a dated local folder, then make a
small "current plans only" layer rather than trying to perfect every old plan.

## Practical Next Milestones

1. Make Moto X audio work end-to-end once:
   - receiver answers `/ping`
   - Moto X sends one M4A chunk
   - PC saves one speech transcript or one ambient note
2. Add the transcript folder to whichever indexer/memory path is current.
3. Decide whether the gateway indexer or old Claudia indexing service is the
   active memory route for this month.
4. Pull current Keep notes and tag them into:
   - active
   - parked
   - reference
   - archive

## Notes For Future AI

- Do not assume `Previously Claudia Core` plans are current. Check the gateway
  repo and Ruby's latest notes first.
- Do not bulk-read the whole workspace. It contains many assets, old exports,
  binaries, and vector database files.
- Prefer current, small docs before old long plans.
- For Moto X, avoid phone-side format conversion unless necessary. Capture
  compressed audio and let the PC do reliable conversion/transcription.
