# Plan: Virtual model harness — VM settings

| Field | Value |
|-------|-------|
| **Doc kind** | `feature-plan` |
| **Owners / areas** | Operator SQLite, settings embed UI, gateway runtime |
| **Status** | `done` |
| **Targets** | Gateway v0.4 |
| **Last updated** | See git history |
| **Supersedes / superseded by** | Child of [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md) |
| **As-built** | [`operator-virtual-models.md`](../features/operator-virtual-models.md) |

## At a glance

Operators enable or disable harness modules per virtual model from `/ui/settings` and persist per-module config in operator SQLite. Gallery fixtures on `/ui/settings/gallery` show multiple harness configuration states for review without live CRUD.

| Phase | Outcome | Status |
|-------|---------|--------|
| [Phase 1 — Virtual model module toggles](#phase-1--virtual-model-module-toggles) | Harness section on VM cards; API for module list and save | `done` |

**Depends on:** [runtime plan](virtual-model-harness-runtime.md) Phase 1 (stage registry exists)  
**Blocks:** retrieval, intent, evaluator, workspace tools (need toggle surface)

**Delivery gates:** [umbrella](virtual-model-turn-harness.md#delivery-gates-normative) — `make precommit` at plan done; hard cut (no legacy paths); phase debt OK if Fix-by is set.

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
- **Gallery** ([umbrella contract](virtual-model-turn-harness.md#gallery--reference-ui-contract-normative)): extend `/ui/settings/gallery` Virtual models section with fixture mounts for (1) default/new-VM harness profile, (2) modules-on stub with reserved evaluator fields hidden/disabled as shipped, (3) tool-executor toggle disabled-until-ready. Nav anchor + part slugs for the harness section.

**Acceptance**

- Create VM, disable retrieval module, chat with workspace scope → no RAG inject for that VM only.
- Toggle changes reload registry without gateway restart.
- Gallery shows at least two harness configuration states side-by-side (or stacked with labeled demos) using production `adminVirtualModels` render path; reviewers can open `/ui/settings/gallery` and inspect toggles without live VM CRUD.
- **Plan delivery:** `make precommit` passes; no legacy dual-path for harness modules.

**Status:** `done`

**Design debt:** [`docs/plans/backlog/harness-ui-design-debt.md`](backlog/harness-ui-design-debt.md) (validator log).

**Delivery validation:** design-validator skill + `make precommit` (see [umbrella delivery gates](virtual-model-turn-harness.md#delivery-gates-normative)).

---

## References

- Code: `internal/operatorstore/`, `internal/server/adminui/api/virtualmodels/`, `embed/embedui/settings/render/cards/adminVirtualModels.js`
- Umbrella: [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md)
