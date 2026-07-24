# Supervised stack (`chimera-supervisor`)

One command starts the **Chimera wrapper stack** according to `config/chimera.yaml`: `chimera-vectorstore`, `chimera-broker`, `chimera-gateway`, and `chimera-indexer` when listed (default: all suite-enabled services). Each managed service is a **wrapper binary** behind a shared health/readiness/lifecycle contract. **SIGINT** / **SIGTERM** shuts down the control plane and children.

**Platform contracts:**

- [Chimera stack config](features/chimera-stack-config.md)
- [Wrapper binary contract](features/chimera-wrapper-binary-contract.md)
- [Structured log lines](features/structured-operator-log-lines.md)
- [Product naming](features/product-naming-contract.md)
- [Locus desktop ↔ supervisor](features/locus-desktop-supervisor.md)

## Runtime layout

| Piece | Role |
|-------|------|
| **`chimera-supervisor`** | Parent; control HTTP (`/healthz`, `/readyz`, `/status`, `/shutdown`); collector gate for child logs |
| **`chimera-vectorstore`** | Vector store wrapper |
| **`chimera-broker`** | LLM broker wrapper |
| **`chimera-gateway`** | Gateway + operator UI |
| **`chimera-indexer`** | Workspace file watcher (when in `supervisor.services`) |

Launch set comes from **`supervisor.services`** (or all `*.enabled: true` services when omitted). Suite `enabled` alone does not start a process.

## Logging

- Per-service **emit** levels: `gateway` / `broker` / `vectorstore` / `indexer` `log_level`
- **Collector gate:** `supervisor.log_level` (overridden by `LOG_LEVEL` env)
- UI / ring buffer only keep lines that pass **both**

## Obtaining binaries

```bash
make chimera-install
make chimera-supervisor-build
make chimera-supervisor-run
```

Desktop: `make up` / `make locus-desktop-run`. See [installation.md](installation.md).

## Common flags

| Flag | Meaning |
|------|---------|
| `-listen` | Control plane bind |
| `-gateway-bin` / `-broker-bin` / `-vectorstore-bin` | Wrapper binaries |
| `-config` | Path to `chimera.yaml` (default via `CHIMERA_CONFIG` / `./config/chimera.yaml`) |

YAML `supervisor:` can supply the same knobs; CLI overrides when set.

## Make targets

- `make chimera-supervisor-run` — foreground stack
- `make chimera-start` / `stop` / `status` — background lifecycle
- `make locus-desktop-run` — desktop (connect-first)

## Logs and operator UI

Child logs tee into the supervisor ring buffer and `data/locus-desktop-supervisor.log` when launched from desktop. Filter by source in `/ui/settings`. Details: [configuration.md](configuration.md), [chimera-stack-config](features/chimera-stack-config.md).
