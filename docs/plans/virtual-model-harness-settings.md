# Plan: Virtual model harness — VM settings

| Field | Value |
|-------|-------|
| **Doc kind** | `feature-plan` |
| **Owners / areas** | Operator SQLite, settings embed UI, gateway runtime |
| **Status** | `draft` |
| **Targets** | Gateway v0.4 |
| **Last updated** | See git history |
| **Supersedes / superseded by** | Child of [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md) |
| **As-built** | None — link to [`docs/features/`](../features/README.md) when shipped |

## At a glance

Operators enable or disable harness modules per virtual model from `/ui/settings` and persist per-module config in operator SQLite.

| Phase | Outcome | Status |
|-------|---------|--------|
| [Phase 1 — Virtual model module toggles](#phase-1--virtual-model-module-toggles) | Harness section on VM cards; API for module list and save | `todo` |

**Depends on:** [runtime plan](virtual-model-harness-runtime.md) Phase 1 (stage registry exists)  
**Blocks:** retrieval, intent, evaluator, workspace tools (need toggle surface)

---

## Background

Virtual models already store fallback chain, routing policy, and tool-router config ([`operator-virtual-models.md`](../features/operator-virtual-models.md)). This plan adds harness module toggles and JSON config blobs per module, reloaded via `ReloadVirtualModels`.

**Related docs:** [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md), [`operator-virtual-models.md`](../features/operator-virtual-models.md).

---

## Phase 1 — Virtual model module toggles

**Goal.** Operators enable or disable harness modules per virtual model from `/ui/settings`.

**Deliverables**

- Operator SQLite: `virtual_model_harness_modules` (or JSON blob on VM row): `module_id`, `enabled`, `config_json` per module.
- Registry reload on VM CRUD (`ReloadVirtualModels`).
- API: `GET/PUT /api/ui/virtual-models/{id}/harness` — list modules, save toggles and config.
- Settings card: harness section with toggles for retrieval, intent, evaluator, escalation, tool executor (disabled until workspace tools plan ships).
- Evaluator mode selector and `stream_policy` field hidden until evaluator plan ships; schema reserves fields.
- Default profile for new VMs: matches today (retrieval on if global RAG on, tool router as today, other modules off).

**Acceptance**

- Create VM, disable retrieval module, chat with workspace scope → no RAG inject for that VM only.
- Toggle changes reload registry without gateway restart.

**Status:** `todo`

---

## References

- Code: `internal/operatorstore/`, `internal/server/adminui/api/virtualmodels/`, `embed/embedui/settings/render/cards/adminVirtualModels.js`
- Umbrella: [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md)
