# Plan: Virtual model harness — per-VM retrieval

| Field | Value |
|-------|-------|
| **Doc kind** | `feature-plan` |
| **Owners / areas** | Gateway RAG, harness retrieval stage, operator virtual models |
| **Status** | `draft` |
| **Targets** | Gateway v0.4 |
| **Last updated** | See git history |
| **Supersedes / superseded by** | Child of [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md) |
| **As-built** | None — link to [`docs/features/`](../features/README.md) when shipped |

## At a glance

Each virtual model applies its own retrieval settings to the request's **project/flavor** scope, with pluggable evidence compression including LLM summarize when hits exceed budget.

| Phase | Outcome | Status |
|-------|---------|--------|
| [Phase 1 — Per-virtual-model retrieval](#phase-1--per-virtual-model-retrieval) | VM config drives retrieval; evidence compression with summarize | `todo` |

**Depends on:** [runtime](virtual-model-harness-runtime.md), [settings](virtual-model-harness-settings.md)  
**Blocks:** [evaluator escalation](virtual-model-harness-evaluator-escalation.md) (re-retrieve uses retrieval config)

---

## Background

RAG today uses gateway-global `top_k` and `score_floor` ([`gateway-rag-ingest-and-retrieval.md`](../features/gateway-rag-ingest-and-retrieval.md)). Scope comes from `X-Chimera-Project` and `X-Chimera-Flavor-Id`. This plan moves retrieval knobs onto the virtual model harness profile and adds a replaceable compression layer.

**Normative decision:** Ship `summarize` in v0.4 via a pluggable `EvidenceCompressor` interface — not deferred.

**Related docs:** [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md), [`gateway-chat-routing-pipeline.md`](../features/gateway-chat-routing-pipeline.md).

---

## Phase 1 — Per-virtual-model retrieval

**Goal.** Retrieval settings live on the virtual model and apply to the request's project/flavor/conversation scope.

**Deliverables**

- Retrieval module config: `top_k`, `score_floor`, `max_context_chars`, `compress_strategy` (`none` \| `truncate` \| `summarize`), `summarize_model_id`, `skip_if` (`empty_query`, `no_workspace`, intent tags).
- Harness retrieval stage reads VM config instead of only global `gateway.yaml` defaults.
- **`EvidenceCompressor` interface** in `internal/harness/evidence/`:
  - `Compress(ctx, hits, budget, cfg) (EvidenceBlock, error)`
- Implementations:
  - `none` — pass through formatted hits
  - `truncate` — drop lowest-scoring hits until under `max_context_chars`
  - `summarize` — small-model call to condense hits; respects `allow_cloud_summary_only` from workspace scope when workspace policy plan ships
- Factory/registry keyed by strategy string — new strategies addable without envelope schema change.
- Evidence aggregation: format hits into `TurnEnvelope.retrieval` (including `compress_strategy`) and structured evidence block for primary inject.
- Fail-open: summarize error → truncate → log `harness.retrieval.compress_fallback`.
- Update [`gateway-chat-routing-pipeline.md`](../features/gateway-chat-routing-pipeline.md) and [`operator-virtual-models.md`](../features/operator-virtual-models.md) when shipped.

**Acceptance**

- Two VMs, same project/flavor scope, different `top_k` → different hit counts in `X-Chimera-RAG-Hits` and envelope.
- Global RAG disabled → retrieval module no-ops regardless of VM toggle.
- VM with `compress_strategy: summarize` over budget → one summarize upstream call; envelope records strategy.
- Summarize failure → truncated evidence delivered; turn completes.

**Status:** `todo`

---

## References

- Code: `internal/rag/`, `internal/server/virtualmodel_chat.go`
- Umbrella: [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md)
