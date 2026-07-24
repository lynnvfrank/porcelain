# Chimera configuration reference

Chimera reads **`config/chimera.yaml`** (supervised stack config) plus companion YAML and environment variables. Virtual models and indexer workspaces live in **operator SQLite** (`/ui/settings`), not in this file.

## Operator vocabulary

| Product | Role |
|---------|------|
| **chimera-gateway** | Client-facing API, search orchestration, operator UI |
| **chimera-broker** | LLM relay |
| **chimera-vectorstore** | Vector storage for search |
| **chimera-indexer** | Workspace file ingest |
| **chimera-supervisor** | Launches and collects logs for the stack |

## Config path resolution

1. `CHIMERA_CONFIG` when set
2. Otherwise `./config/chimera.yaml` (relative to process working directory)

## YAML vs SQLite

| Layer | Home | Examples |
|-------|------|----------|
| Stack / deploy | `chimera.yaml` | Supervisor launch, listen URLs, emit log levels, search platform, indexer tuning |
| Product / per-VM | Operator SQLite | Virtual models, harness modules, workspaces, conversations |

## `config/chimera.yaml` layout

Section order: `supervisor` → `gateway` → `broker` → `vectorstore` → `indexer` → `search`.

### Suite membership vs launch

- **`*.enabled`** — service is part of the suite (config meaningful; UI may show it). Does **not** start a process.
- **`supervisor.services`** — which children the supervisor starts. Omitted → all `enabled: true` services. Listing a suite-disabled service is a startup error.
- Enabled but not launched → treat as external; use that service’s URL.

### Logging (two axes)

| Axis | Key | Meaning |
|------|-----|---------|
| Emit | `gateway.log_level`, `broker.log_level`, `vectorstore.log_level`, `indexer.log_level` | Minimum level the process writes |
| Collector gate | `supervisor.log_level` | Minimum level kept in the ring buffer / `/ui` logs / supervisor tee |

A line appears only if the service emitted it **and** the gate allows that level. `LOG_LEVEL` env overrides **`supervisor.log_level`** (gate only). Gateway process slog still uses `gateway.log_level`.

### Supervisor

| Field | Description |
|-------|-------------|
| `supervisor.listen` | Control plane bind (default `127.0.0.1:7710`) |
| `supervisor.log_level` | Collector gate |
| `supervisor.log_json` | JSON logs (default true) |
| `supervisor.services` | Launch list; omit for all enabled services |
| `supervisor.*_bin` / `*_listen` / waits | Optional overrides of CLI flags |

### Gateway

| Field | Description |
|-------|-------------|
| `gateway.enabled` | Suite membership (default true) |
| `gateway.listen_host` / `listen_port` | HTTP bind |
| `gateway.log_level` | Gateway **emit** level |
| `gateway.timeouts.broker_ms` | Broker health / models fetch timeout |
| `gateway.timeouts.chat_ms` | Chat completion timeout |
| `gateway.catalog.poll_ms` | Broker catalog poll (0 disables periodic) |
| `gateway.auth.api_keys` | Path to `api-keys.yaml` |
| `gateway.metrics.*` | Usage SQLite for quotas (applied at process start) |

### Broker / vectorstore / indexer

| Field | Description |
|-------|-------------|
| `broker.url` | Broker base URL |
| `broker.log_level` | Broker wrapper emit (`-log-level`) |
| `broker.models.free_tier` / `limits` | Companion YAML paths |
| `vectorstore.url` | Vector store HTTP URL |
| `vectorstore.log_level` | Vectorstore / backend emit |
| `indexer.enabled` | Suite membership |
| `indexer.config_path` | Optional last-wins overlay YAML |
| `indexer.*` | Same tuning keys as standalone `indexer.yaml` (workers, `log_level`, …) |

Supervised indexer merges inline `indexer:` with optional overlay, materializes to `data/gateway/indexer.materialized.yaml`, and passes that as `--config`. UI GET returns effective YAML; UI PUT writes the overlay (default `indexer.yaml` beside `chimera.yaml`).

### Search platform

| Field | Description |
|-------|-------------|
| `search.enabled` | Hard gate for ingest APIs, chat retrieval, vectorstore health check |
| `search.embedding.*` | Embedding model/path/dim (global; corpus rebuild if changed) |
| `search.chunking.*` / `ingest.*` | Advertised to indexer / ingest limits |
| `search.retrieval_defaults.*` | Seed for new virtual-model retrieval modules (`top_k`, score) |
| `search.coherence` / `tooling` | Stale-index mode; expansion APIs |

HTTP routes remain `/v1/rag/*`.

`GET /health` includes `checks.vectorstore` when `search.enabled` is true. Chat routing stays per virtual model in SQLite — see [operator-virtual-models](features/operator-virtual-models.md).

## Environment variables

| Variable | Description |
|----------|-------------|
| `CHIMERA_CONFIG` | Path to `chimera.yaml` |
| `CHIMERA_BROKER_API_KEY` | Bearer to chimera-broker (`broker.api_key_env`) |
| `LOG_LEVEL` | Overrides **supervisor collector** gate |
| `CHIMERA_GATEWAY_URL` / `CHIMERA_GATEWAY_TOKEN` | Indexer → gateway |

Provider keys (`GROQ_API_KEY`, …) are consumed by BiFrost, not the gateway.

## Companion files

| File | Role |
|------|------|
| `api-keys.yaml` | Client Bearer secrets |
| `provider-free-tier.yaml` | Free-tier / catalog seed |
| `provider-model-limits.yaml` | RPM/RPD quotas + optional context_window (needs `gateway.metrics.enabled`) |

See also [supervisor.md](supervisor.md), [indexer.md](indexer.md), [features/chimera-stack-config.md](features/chimera-stack-config.md).
