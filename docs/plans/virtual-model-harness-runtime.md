# Plan: Virtual model harness — runtime and envelope

| Field | Value |
|-------|-------|
| **Doc kind** | `feature-plan` |
| **Owners / areas** | Gateway runtime, chat path, operator SQLite |
| **Status** | `draft` |
| **Targets** | Gateway v0.4 |
| **Last updated** | See git history |
| **Supersedes / superseded by** | Child of [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md) |
| **As-built** | None — link to [`docs/features/`](../features/README.md) when shipped |

## At a glance

Replace ad-hoc ordered calls in virtual-model chat with a **stage registry** and a shared **turn envelope** carried through every stage — while preserving today's routing, RAG, tool router, and fallback behavior.

| Phase | Outcome | Status |
|-------|---------|--------|
| [Phase 1 — Harness runtime and stage contract](#phase-1--harness-runtime-and-stage-contract) | Existing routing pipeline runs as registered stages with unchanged behavior | `done` |
| [Phase 2 — Turn envelope schema](#phase-2--turn-envelope-schema) | Stable JSON artifact carried through every stage; logged and persisted redacted | `done` |

**Depends on:** nothing  
**Blocks:** all other `virtual-model-harness-*` plans

---

## Background

Today `handleVirtualModelChat` runs a fixed five-step pipeline ([`gateway-chat-routing-pipeline.md`](../features/gateway-chat-routing-pipeline.md)). v0.4 introduces `internal/harness/` with explicit stage registration and a `TurnEnvelope` shared across stages. This plan delivers the foundation; module-specific stages ship in sibling plans.

**Related docs:** [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md), [`gateway-chat-routing-pipeline.md`](../features/gateway-chat-routing-pipeline.md).

---

## Phase 1 — Harness runtime and stage contract

**Goal.** Replace ad-hoc ordered calls in `handleVirtualModelChat` with a **stage registry** while preserving today's chat behavior.

**Deliverables**

- Package `internal/harness/`: `TurnContext`, `Stage` interface (`Run(ctx, *TurnEnvelope, proxiedJSON) error`), ordered registry.
- Register existing behaviors as stages: stack resolve, tool router, RAG retrieve+inject, initial pick, fallback proxy loop.
- Fail-safe defaults documented per stage kind (transform/retrieval fail-open unless configured otherwise).
- Emit `harness.stage.started` / `harness.stage.completed` with `stage`, `module`, `duration_ms`, `outcome`, `virtual_model_id`, `turn_index`.
- Integration tests: parity with pre-refactor routing, RAG, and fallback fixtures.

**Acceptance**

- `go test` harness parity suite passes; manual chat with two VMs still routes to different upstream models.
- No operator-visible behavior change except new debug slugs in logs.

**Status:** `done`

---

## Phase 2 — Turn envelope schema

**Goal.** Every chat turn builds and mutates a **`TurnEnvelope`**; redacted snapshots appear in logs and SQLite.

**Deliverables**

- Go types + JSON marshal for `schema_version: 1` (fields per normative sketch in [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md)).
- Populate identity fields at harness entry (`request_id`, `conversation_id`, `turn_index`, `virtual_model_id`, scope from `X-Chimera-Project` / `X-Chimera-Flavor-Id` resolution).
- Redaction helper: strip message bodies and tool arguments from logged/persisted envelope; keep counts and ids.
- Column `conversation_turns.harness_summary_json` (migration) for operator-facing summary.
- Optional response header `X-Chimera-Harness-Summary` (base64 JSON, redacted) on completed turns.

**Acceptance**

- Completed turn has non-empty envelope in debug logs; history reload shows `harness_summary_json` when observability plan UI lands.
- Secrets and raw prompts never appear in envelope at Info level.

**Status:** `done`

---

## References

- Code: `chimera/chimera-gateway/internal/server/virtualmodel_chat.go`, `internal/chat/chat.go`
- Umbrella: [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md)
