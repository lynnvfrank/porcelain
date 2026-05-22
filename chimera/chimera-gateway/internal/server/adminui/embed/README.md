# Admin UI embed package

Go package that serves operator HTML and static assets from `embedui/`.

- **Routes:** `routes.go` — page and asset handlers (`/ui`, `/ui/settings`, `/ui/assets/...`).
- **Embed FS:** `assets.go` — `//go:embed` and optional `CHIMERA_ADMINUI_ROOT` disk override.
- **Front-end tree:** [`embedui/README.md`](embedui/README.md) — page map, asset prefixes, `ChimeraSettings` layout.

Registration: `adminui/register.go` calls `embed.Register` unconditionally; log **API** routes are gated separately in `api/logs/register.go` when `LogStore` is nil.
