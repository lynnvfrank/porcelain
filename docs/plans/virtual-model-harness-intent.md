# Plan: Virtual model harness — intent classification

| Field | Value |
|-------|-------|
| **Doc kind** | `feature-plan` |
| **Owners / areas** | Gateway harness, routing, operator virtual models API |
| **Status** | `draft` |
| **Targets** | Gateway v0.4 |
| **Last updated** | See git history |
| **Supersedes / superseded by** | Child of [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md) |
| **As-built** | None — link to [`docs/features/`](../features/README.md) when shipped |

## At a glance

Populate the turn envelope **intent** block from deterministic heuristics first, with optional LLM assist behind a VM toggle, plus a dry-run evaluate API for pre-primary stages.

| Phase | Outcome | Status |
|-------|---------|--------|
| [Phase 1 — Intent classification (heuristic first)](#phase-1--intent-classification-heuristic-first) | Intent block populated; evaluate API without primary completion | `todo` |

**Depends on:** [runtime](virtual-model-harness-runtime.md), [settings](virtual-model-harness-settings.md), [workspace policy](virtual-model-harness-workspace-policy.md) (heuristics read scope)  
**Blocks:** [evaluator](virtual-model-harness-evaluator-escalation.md) (optional LLM classifier pattern)

---

## Background

Routing policy today picks initial upstream model from message length rules ([`gateway-chat-routing-pipeline.md`](../features/gateway-chat-routing-pipeline.md)). The harness adds structured intent signals on the turn envelope for retrieval skip rules, resource planning, and observability.

**Related docs:** [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md), [`virtual-models-operator.md`](virtual-models-operator.md) (routing evaluate API pattern).

---

## Phase 1 — Intent classification (heuristic first)

**Goal.** Turn envelope `intent` block is populated from deterministic rules; optional LLM classifier behind VM toggle.

**Deliverables**

- Heuristic classifier: signals from last user message length, tool declaration count, workspace policy, RAG hit presence.
- Optional LLM classifier when module enabled: small model returns JSON matching `intent` shape; fail-open to heuristics on error.
- Resource planner stub: map `complexity` / `task_type` to initial fallback index or rule hint (extends existing routing policy, does not replace it).
- Dry-run: `POST /api/ui/virtual-models/{id}/harness/evaluate` returns envelope after pre-primary stages (no upstream completion).

**Acceptance**

- Evaluate API returns populated `intent` for sample messages without charging a primary completion.
- Heuristic-only VM never calls classifier model.

**Status:** `todo`

---

## References

- Code: `internal/routing/`, `internal/server/adminui/api/virtualmodels/`
- Umbrella: [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md)
