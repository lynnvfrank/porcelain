# Embed UI component gallery

Static styleguide for the gateway summarized logs embed UI. Open these pages in a browser to tune CSS and layout **without** rebuilding chimera-gateway or running `make`. The gallery is **not** served by the gateway by default (no `/ui/gallery` route).

## Open

**Quickest:** double-click or drag into a browser:

- [`gallery.html`](gallery.html) — primitives, cards, event-log demos
- [`gallery-unified-operator.html`](gallery-unified-operator.html) — operator card rail draft
- [`sample.html`](sample.html) — design tokens only

**Optional static server** (from repo root):

```bash
python -m http.server 8765
```

Then open:

- http://localhost:8765/docs/component-gallery/gallery.html
- http://localhost:8765/docs/component-gallery/gallery-unified-operator.html
- http://localhost:8765/docs/component-gallery/sample.html

Edit production CSS under `chimera/chimera-gateway/internal/server/adminui/embed/embedui/`, save, and reload the gallery tab. Use the **Default / Porcelain** theme toggle to preview `html[data-theme="porcelain"]`.

## File map

| File | Purpose |
|------|---------|
| `gallery.html` | Phase 2 component matrix: typography, filters, pills/badges, status, log lines, progress, tables, KV, cards, event-log panels |
| `gallery-unified-operator.html` | Draft operator shell above the log stream (overview, users/tokens, providers, routing) |
| `sample.html` | Phase 1 token swatches and index (`theme-tokens.css` only) |
| `gallery-shell.css` | Gallery-only layout and nav (not embedded by the gateway) |
| `gallery-event-log-demo.js` | Mock filter, selection, copy, and footer time for `sum-evlog` demos in `gallery.html` |
| `gallery-unified-operator-routing.js` | Routing/fallback YAML demo affordances |
| `gallery-unified-operator-users.js` | Users & gateway token draft cards |
| `reload.svg` | Copy of embed reload icon for YAML overlay buttons |

## Production CSS paths

From any HTML file in this directory:

| Asset | Relative `href` |
|-------|-----------------|
| Design tokens | `../../chimera/chimera-gateway/internal/server/adminui/embed/embedui/theme-tokens.css` |
| Shared primitives | `../../chimera/chimera-gateway/internal/server/adminui/embed/embedui/ui.css` |
| UI components (JS) | `../../chimera/chimera-gateway/internal/server/adminui/embed/embedui/ui/components/*.js` (`ChimeraUI` namespace) |
| Logs composition entry | `../../chimera/chimera-gateway/internal/server/adminui/embed/embedui/logs.css` (imports `embedui/styles/*.css`) |
| Gallery-only layout | `gallery-shell.css` |

## Change contract

When you change embed UI styling or shared primitives, keep the gallery in sync:

1. **`theme-tokens.css`, `logs.css`, or a production class** (e.g. `sum-evlog__*`, `sum-svc-broker`) — update the matching gallery section in the same PR, or note **N/A** in the PR description with a short reason.
2. **New primitive or card pattern** — add or extend a gallery section **before** (or in the same PR as) wiring it in `/ui/logs` (gallery-first).
3. **Gallery `<link>` / `src` paths** — must stay relative to `docs/component-gallery/` and point at `chimera/chimera-gateway/internal/server/adminui/embed/embedui/` for production CSS (see table above). CI runs `make component-gallery-check`.

Manual check: open `gallery.html`, toggle Porcelain, and spot-check the section you touched.

## CI check

From repo root:

```bash
make component-gallery-check
```

Windows (PowerShell):

```powershell
pwsh -File scripts/check-component-gallery-paths.ps1
```

## Live app module map

For the shipped `/ui/logs` script graph, APIs, and load order, see:

[`chimera/chimera-gateway/internal/server/adminui/embed/embedui/logs/README.md`](../../chimera/chimera-gateway/internal/server/adminui/embed/embedui/logs/README.md)

## Related plans

- Gallery repair and upkeep: [`docs/plans/embedui-component-gallery.md`](../plans/embedui-component-gallery.md)
- Theme tokens and original styleguide: [`docs/plans/embedui-theme-styleguide.md`](../plans/embedui-theme-styleguide.md)
- Event log panel contract: [`docs/plans/embedui-event-log-panel.md`](../plans/embedui-event-log-panel.md)
- Unified operator shell: [`docs/plans/unified-logs-operator-shell.md`](../plans/unified-logs-operator-shell.md)
