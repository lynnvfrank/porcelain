# Operator logs UI (`embedui/logs/`)

Route: `/ui/logs` — shell HTML: `embedui/logs.html`.

## URL → disk map

| Served URL | Embed path | Role |
|------------|------------|------|
| `/ui/assets/logs.js` | `embedui/logs_entry.js` | Entry: calls `ChimeraLogs.Main()` after modules load |
| `/ui/assets/logs/main.js` | `embedui/logs_app.js` | App boot, state, transport ctx, module mount |
| `/ui/assets/logs/contracts.js` | `embedui/logs/contracts.js` | Constants mirroring `internal/naming/gateway_logs.go` |
| `/ui/assets/logs/**` | `embedui/logs/**` | Pure derive, components, `app/`, `render/` |

## Script load order

See the comment block in `logs.html`. Do not reorder without checking dependencies:

1. `testing/loader.js`, `contracts.js`
2. `util/*`, `parse/*`, `transport/streaming.js`
3. `derive/*` (broker, vectorstore, gateway, indexer, conversation)
4. `components/*`, `render/sumEvlog.js`
5. `app/summarizedFeed.js`, `app/wireHandlers.js`
6. `main.js` (`logs_app.js`), `logs.js` (`logs_entry.js`)

## HTTP APIs (operator)

| Endpoint | Use |
|----------|-----|
| `GET /api/ui/logs` | Initial tail + backfill (`seq`, `source`, `text`, `ts`) |
| `GET /api/ui/logs/stream` | SSE live lines |
| `GET /api/ui/metrics` | Gateway usage card (SQLite rollup) |
| `GET /api/ui/state` | Gateway overview + admin YAML |
| `GET /api/ui/tokens` | Token labels for conversation titles |
| `GET /api/ui/chimera-broker/providers` | Broker provider health strip |

## View modes

Summarized-only in current builds (`viewMode === "summarized"`). Panel: `#panel-summarized` (`data-testid="panel-summarized"`).

| Concern | Owner module |
|---------|----------------|
| SSE / tail / backfill | `transport/streaming.js` |
| Summarized feed rebuild | `app/summarizedFeed.js` |
| Event-log rows in cards | `render/sumEvlog.js` |
| DOM clicks / admin forms | `app/wireHandlers.js` |
| Card metrics (pure) | `derive/*` |

## If you change X, also check Y

- `timeline_kind` slugs in Go → `contracts.js` + `derive/gatewayCardModel.js` / conversation join
- New derive export → `logs_components_test.go` goja fixture
- Embed path → `adminui/ui_handlers.go` `//go:embed` and mux routes
- Service badge CSS → `logs.css` + `contracts.serviceBadgeClass` / summarized badge builders
