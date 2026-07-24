# Plan: Virtual model harness — workspace policy

| Field | Value |
|-------|-------|
| **Doc kind** | `feature-plan` |
| **Owners / areas** | Operator SQLite workspaces, harness meta-policy stage, settings UI |
| **Status** | `draft` |
| **Targets** | Gateway v0.4 |
| **Last updated** | See git history |
| **Supersedes / superseded by** | Child of [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md) |
| **As-built** | None — link to [`docs/features/`](../features/README.md) when shipped |

## At a glance

Workspaces declare sensitivity and file permissions; a deterministic meta-policy stage derives scope from **project/flavor headers** and runs before LLM-assisted stages.

| Phase | Outcome | Status |
|-------|---------|--------|
| [Phase 1 — Workspace policy and meta-policy](#phase-1--workspace-policy-and-meta-policy) | Workspace fields, settings UI, meta-policy stage | `todo` |

**Depends on:** [runtime](virtual-model-harness-runtime.md), [settings](virtual-model-harness-settings.md)  
**Blocks:** [workspace tools](virtual-model-harness-workspace-tools.md), cloud-aware summarize in [retrieval](virtual-model-harness-retrieval.md)

---

## Background

Indexer workspaces today store project, flavor, and paths ([`indexer-workspaces.md`](../features/indexer-workspaces.md)). Chat already sends `X-Chimera-Project` and `X-Chimera-Flavor-Id` ([`operator-chat-ui.md`](../features/operator-chat-ui.md)). `X-Chimera-Workspace-Id` is sent for conversation history only and is **not** used for policy or RAG scope in v0.4.

**Normative decision:** Workspace scope wire format is **project/flavor only**. Gateway looks up workspace row(s) in operator SQLite.

**Related docs:** [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md), [`indexer-workspaces.md`](../features/indexer-workspaces.md).

---

## Phase 1 — Workspace policy and meta-policy

**Goal.** Workspaces declare sensitivity and file permissions; a deterministic meta-policy stage runs before LLM-assisted stages.

**Deliverables**

- Workspace row fields: `sensitivity` (`public` \| `internal` \| `private`), `allow_cloud` (bool), `allow_cloud_summary_only` (bool), `file_action_policy` (`none` \| `read` \| `read_write`).
- Migration + settings UI on workspace cards.
- **`ResolveWorkspaceScope(tenant, project, flavor)`** — query SQLite for matching rows.
  - If **multiple rows** match: **lowest `workspaces.id` wins**; log `harness.scope.workspace_ambiguous` at Info with `{ matched_ids, chosen_id }`.
  - Only the chosen row's `workspace_paths[]` used for file tools in v0.4.
- Meta-policy stage: set `TurnEnvelope.scope` (including derived `workspace_id`); veto cloud routes and tool execution when policy forbids.
- Classifier/cloud stages consult `scope.allow_cloud`; workspace `sensitivity` overrides classifier suggestions.
- Document wire contract: `X-Chimera-Project` + `X-Chimera-Flavor-Id` select scope; `X-Chimera-Workspace-Id` remains history metadata only.

**Acceptance**

- Workspace `private` + `allow_cloud: false` → fallback chain skips cloud-only models before upstream call.
- `file_action_policy: none` → tool executor stage rejects file tools even if primary model requests them.
- Two DB rows with same project/flavor → deterministic lowest-id choice logged once per turn.

**Status:** `todo`

---

## References

- Code: `internal/operatorstore/`, `internal/server/adminui/api/indexer/`, `embed/embedui/settings/`
- Umbrella: [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md)
