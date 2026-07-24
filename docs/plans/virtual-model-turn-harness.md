# Plan: Virtual model turn harness (index)

| Field | Value |
|-------|-------|
| **Doc kind** | `feature-plan` |
| **Owners / areas** | Gateway runtime, operator SQLite, chat path, operator embed UI (settings logs, chat), RAG, workspaces |
| **Status** | `draft` |
| **Targets** | Gateway v0.4 |
| **Last updated** | See git history |
| **Supersedes / superseded by** | Supersedes ensemble-first framing in prior [`version-v0.4.md`](../version-v0.4.md); ensemble and human escalation become harness modules |
| **As-built** | None — link to [`docs/features/`](../features/README.md) when shipped |

## At a glance

Operators pick one **named virtual model** in chat (single-model picker UX — like Cursor's one visible model choice, even when the gateway uses multiple upstream models internally) and the gateway runs a full **turn harness** before answering: classify intent, plan retrieval and tools, run the primary model, optionally evaluate and escalate, then return one reply. Each virtual model toggles harness modules on or off and holds per-module settings. The client sends a single chat request per user turn with an **explicit** `body.model` virtual model id; all orchestration stays inside the gateway.

| Child plan | Outcome | Status |
|------------|---------|--------|
| [Runtime + envelope](virtual-model-harness-runtime.md) | Stage registry; turn envelope schema and persistence | `active` |
| [VM harness settings](virtual-model-harness-settings.md) | Module toggles per virtual model in settings | `todo` |
| [Per-VM retrieval](virtual-model-harness-retrieval.md) | VM-scoped retrieval + pluggable evidence compression | `todo` |
| [Workspace policy](virtual-model-harness-workspace-policy.md) | Sensitivity, cloud rules, file permissions; meta-policy stage | `todo` |
| [Intent classification](virtual-model-harness-intent.md) | Heuristic intent + optional LLM; evaluate API | `todo` |
| [Evaluator + escalation v1](virtual-model-harness-evaluator-escalation.md) | Single-pass evaluator; re-retrieve and fallback escalation | `todo` |
| [Gateway workspace tools](virtual-model-harness-workspace-tools.md) | Read/write files under workspace permission in one turn | `todo` |
| [Observability](virtual-model-harness-observability.md) | Stage timeline in settings logs and chat turn details | `todo` |
| [Advanced modules](virtual-model-harness-advanced-modules.md) | Multi-draft evaluator; human escalation target | `todo` |

**Suggested execution order:** Runtime → Settings (UI after runtime Phase 1) → Retrieval + Workspace policy (parallel after envelope) → Intent → Evaluator/Escalation → Tools → Observability (after envelope + slugs exist) → Advanced modules last.

---

## Background

Virtual models today attach a **routing stack**: fallback chain, routing-policy rules, and optional tool router ([`operator-virtual-models.md`](../features/operator-virtual-models.md)). Chat requests pass through a fixed five-step pipeline ([`gateway-chat-routing-pipeline.md`](../features/gateway-chat-routing-pipeline.md)) — tool slimming, global RAG inject, initial upstream pick, fallback loop — then proxy once to the broker. That delivered an early working product but not the orchestration depth described in [`design.md`](../design.md).

**v0.4** reframes the gateway as a **turn harness**: a composable, per-virtual-model workflow that can add LLM-assisted stages when enabled, while **meta-policy** (privacy, cost, eligibility) stays deterministic and runs before any classifier sees full context. The client contract stays minimal: one `model` string on `POST /v1/chat/completions`, one HTTP round-trip per user message. The gateway may call upstream many times internally (classifier, retrieval, primary, evaluator, tool rounds).

Prior v0.4 ideas — two-phase ensemble, `//deep` triggers, external human escalation as standalone pillars — are **modules inside this harness**, not separate product surfaces. MCP-backed tool execution remains **v0.5**; v0.4 defines the tool-invocation contract and ships **gateway-native workspace tools** first.

**Guiding principles (normative for v0.4)**

1. **Virtual model = harness profile** — module toggles and per-module config live on the VM row (operator SQLite).
2. **Single client request per user turn** — internal multi-stage loop; bounded by `max_tool_rounds`, `max_escalation_rounds`, `max_upstream_calls_per_turn`, and wall-clock timeout.
3. **Start simple, iterate per stage** — ship a thin vertical slice (existing pipeline as stages + per-VM RAG + optional single evaluator) before deepening classifiers and ensemble modes.
4. **Observability is first-class** — every stage emits `harness.stage.*` slugs with `virtual_model_id`, `conversation_id`, `request_id`, `turn_index`.
5. **No Continue / IDE agent dependency** — Chimera chat owns orchestration; file actions run in-gateway under workspace policy, not via external agent clients.
6. **Direct upstream ids** remain an escape hatch (`provider/model` bypasses harness); the product path is virtual model ids.
7. **Explicit virtual model id** — no reserved aliases; `body.model` must match a VM `model_id` or a direct upstream id. The product shows a **single-model picker** even when the harness uses multiple upstream models via fallback, evaluator, and escalation.

**Related docs:** [`version-v0.4.md`](../version-v0.4.md), [`design.md`](../design.md), [`gateway-chat-routing-pipeline.md`](../features/gateway-chat-routing-pipeline.md), [`operator-virtual-models.md`](../features/operator-virtual-models.md), [`gateway-rag-ingest-and-retrieval.md`](../features/gateway-rag-ingest-and-retrieval.md), [`indexer-workspaces.md`](../features/indexer-workspaces.md), [`operator-conversation-history.md`](../features/operator-conversation-history.md), [`log-conversations.md`](log-conversations.md), [`virtual-models-operator.md`](virtual-models-operator.md).

---

## Harness modules (reference)

Modules attach to a virtual model. **Meta-policy** and **primary** are always on; others are toggleable.

| Module | Responsibility | Child plan |
|--------|----------------|------------|
| `meta_policy` | Deterministic privacy, cloud eligibility, file-action gate from workspace policy | [workspace policy](virtual-model-harness-workspace-policy.md) |
| `intent_classifier` | Populate `intent` on turn envelope (heuristic → optional LLM) | [intent](virtual-model-harness-intent.md) |
| `resource_planner` | Map intent to initial chain entry / model tier | [intent](virtual-model-harness-intent.md) (heuristic stub) |
| `retrieval` | Per-VM vector search, thresholds, compression | [retrieval](virtual-model-harness-retrieval.md) |
| `tool_router` | Slim client tool declarations (existing) | [runtime](virtual-model-harness-runtime.md) (parity) |
| `tool_executor` | Run tools inside gateway turn (`ToolExecutor` interface) | [workspace tools](virtual-model-harness-workspace-tools.md) |
| `evidence_aggregate` | Merge RAG hits, tool outputs, prior context into structured block | [retrieval](virtual-model-harness-retrieval.md) |
| `primary` | Main upstream completion + internal tool round loop | [runtime](virtual-model-harness-runtime.md) (parity) |
| `evaluator` | Correctness / confidence check; `single_pass` then `multi_draft` | [evaluator](virtual-model-harness-evaluator-escalation.md), [advanced](virtual-model-harness-advanced-modules.md) |
| `escalation` | Re-retrieve, chain walk, ensemble trigger, human target | [evaluator](virtual-model-harness-evaluator-escalation.md), [advanced](virtual-model-harness-advanced-modules.md) |
| `response_builder` | Citations, formatting, response metadata headers | [observability](virtual-model-harness-observability.md) |
| `telemetry` | Turn envelope persistence, learning hooks (log-only in v0.4) | [runtime](virtual-model-harness-runtime.md), [observability](virtual-model-harness-observability.md) |

Module toggles and per-module config surface in [VM harness settings](virtual-model-harness-settings.md).

---

## Turn envelope schema (normative sketch)

All stages read and write a shared **`TurnEnvelope`** (JSON). Unused fields use `null`, `"unknown"`, or empty arrays until populated.

`scope.workspace_id` is **derived** from project/flavor workspace lookup (see [workspace policy plan](virtual-model-harness-workspace-policy.md)), not from a client header.

```json
{
  "schema_version": 1,
  "request_id": "…",
  "conversation_id": "…",
  "turn_index": 1,
  "virtual_model_id": "Research-1.0",
  "scope": {
    "tenant_id": "…",
    "project_id": "…",
    "flavor_id": "…",
    "workspace_id": 42,
    "workspace_permission": "read_write_files",
    "sensitivity": "internal",
    "allow_cloud": true
  },
  "intent": {
    "task_type": "unknown",
    "domain": "unknown",
    "complexity": "unknown",
    "ambiguity": "unknown",
    "sensitivity": "unknown",
    "requires_rag": null,
    "requires_tools": null,
    "tags": []
  },
  "plan": {
    "stages": [],
    "primary_model_id": null,
    "evaluator_mode": null,
    "escalation_budget": 0
  },
  "retrieval": {
    "ran": false,
    "top_k": null,
    "hits_count": 0,
    "evidence_ids": [],
    "compress_strategy": null
  },
  "execution": {
    "tool_calls": [],
    "upstream_attempts": [],
    "resolved_model_id": null
  },
  "evaluation": {
    "ran": false,
    "confidence": null,
    "issues": [],
    "recommend_escalation": false
  },
  "escalation": {
    "rounds": 0,
    "last_action": null
  },
  "response": {
    "citations": [],
    "metadata": {}
  }
}
```

Field names and redaction rules are locked in [runtime plan](virtual-model-harness-runtime.md) Phase 2.

---

## Resolved decisions

1. **Streaming** — Flexible `stream_policy` per VM evaluator config (`immediate` \| `gate_on_evaluator` \| `buffer_until_complete`). See [evaluator plan](virtual-model-harness-evaluator-escalation.md).
2. **Workspace scope wire format** — `X-Chimera-Project` + `X-Chimera-Flavor-Id` only; gateway derives workspace row via DB lookup with lowest-id tie-break. `X-Chimera-Workspace-Id` is conversation-history metadata only. See [workspace policy plan](virtual-model-harness-workspace-policy.md).
3. **Tool declarations** — Gateway-injected only when `tool_executor` enabled; client `tools` ignored on VM harness path. See [workspace tools plan](virtual-model-harness-workspace-tools.md).
4. **Evidence compression** — Pluggable `EvidenceCompressor`; ship `summarize` in v0.4 with fail-open to `truncate`. See [retrieval plan](virtual-model-harness-retrieval.md).
5. **Model selection** — Explicit VM id only; no `auto` alias or synthetic catalog id. Single-model picker UX; internal multi-upstream orchestration is invisible to the client.

---

## Bounded loop limits (normative defaults)

Document in gateway config and VM harness profile:

| Limit | Default | Purpose |
|-------|---------|---------|
| `max_tool_rounds` | 5 | Internal tool loop per turn |
| `max_escalation_rounds` | 2 | Re-retrieve / re-plan cycles |
| `max_upstream_calls_per_turn` | 15 | Broker call budget |
| `harness_wall_clock_timeout` | 120s | Per client request |

---

## References

- Child plans: `virtual-model-harness-*.md` (this directory)
- Orchestration today: `chimera/chimera-gateway/internal/server/virtualmodel_chat.go`, `internal/chat/chat.go`
- Virtual models: `internal/virtualmodel/`, `internal/operatorstore/`
- RAG: `internal/rag/`
- Conversation logs: `docs/plans/log-conversations.md`, `embed/embedui/settings/derive/conversationCardModel.js`
- Chat UI: `embed/embedui/chat/`
- North-star: [`design.md`](../design.md)
- Version roadmap: [`version-v0.4.md`](../version-v0.4.md)
