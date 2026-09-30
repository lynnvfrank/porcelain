# Generated documentation

Files in this directory are produced by `make contracts-generate`. Do not edit them by hand.

| Output | Generator |
|--------|-----------|
| [`operator-sqlite-migrations.md`](operator-sqlite-migrations.md) | `go run ./internal/docgen/migrations/cmd` |
| [`harness-stages.md`](harness-stages.md) | `go generate ./chimera/chimera-gateway/internal/harness/...` |
| [`log-slug-index.md`](log-slug-index.md) | `go generate ./internal/operatorcopy/...` |

Stale checks run as part of `make contracts-check`.
