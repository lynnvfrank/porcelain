# Plan: Virtual model harness — advanced modules

| Field | Value |
|-------|-------|
| **Doc kind** | `feature-plan` |
| **Owners / areas** | Gateway harness, evaluator, escalation, chat UI |
| **Status** | `draft` |
| **Targets** | Gateway v0.4 (same train; after MVP phases 1–10) |
| **Last updated** | See git history |
| **Supersedes / superseded by** | Child of [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md) |
| **As-built** | None — link to [`docs/features/`](../features/README.md) when shipped |

## At a glance

**Multi-draft evaluator** (ensemble as an evaluator mode) and **human escalation** as an escalation target when in-loop options exhaust. Ships after harness MVP (runtime through observability).

| Phase | Outcome | Status |
|-------|---------|--------|
| [Phase 1 — Evaluator multi-draft mode](#phase-1--evaluator-multi-draft-mode) | Parallel drafts, synthesize, judge — one client answer | `todo` |
| [Phase 2 — Human escalation module](#phase-2--human-escalation-module) | Copy-paste external escalation with paste-back merge | `todo` |

**Depends on:** [evaluator + escalation v1](virtual-model-harness-evaluator-escalation.md)

---

## Background

Prior v0.4 drafts treated two-phase ensemble and external human escalation as standalone features. They are now modules inside the harness ([`virtual-model-turn-harness.md`](virtual-model-turn-harness.md)). Streaming policies from the evaluator plan extend to multi-draft phases (buffer until synthesize completes unless VM `stream_policy` is `immediate` for telemetry-only eval).

**Related docs:** [`version-v0.4.md`](../version-v0.4.md), [`design.md`](../design.md).

---

## Phase 1 — Evaluator multi-draft mode

**Goal.** Ensemble becomes an evaluator implementation: parallel drafts, synthesize, then judge — unified config surface.

**Deliverables**

- Evaluator `mode: multi_draft`: config `draft_count` (default 3, cap by catalog availability), `synthesize_model_id`.
- Gateway orchestrates N parallel draft completions via broker, then synthesize pass, then evaluator JSON.
- VM-level triggers (complexity threshold, manual depth flag in message or header) — replace legacy `//deep` on fixed semver id.
- Streaming semantics documented: draft-phase failure, synthesize failure, interaction with `stream_policy`.
- Reuse escalation module when evaluator still recommends escalation after multi-draft.

**Acceptance**

- VM with `multi_draft` enabled completes draft → synthesize → evaluate → one client-visible answer.
- Logs show draft count, models used, phase boundaries.

**Status:** `todo`

---

## Phase 2 — Human escalation module

**Goal.** External human escalation is one escalation target when in-loop options exhaust.

**Deliverables**

- Escalation `on_fail: human` config: named surfaces (name + URL), privacy disclosure text, paste-back delimiter.
- Response construction stage emits escalation body with copy-paste prompt when triggered.
- Later message with delimiter merges external answer into thread (conversation merge or harness entry hook).
- Non-blocking: no delimiter on next message → normal chat continues.

**Acceptance**

- Documented path: low confidence → escalation message with privacy line → paste-back → merged continuation.
- Human escalation never runs before internal escalation budget exhausted (configurable).

**Status:** `todo`

---

## References

- Code: `internal/harness/`, `internal/chat/chat.go`
- Evaluator v1: [`virtual-model-harness-evaluator-escalation.md`](virtual-model-harness-evaluator-escalation.md)
- Umbrella: [`virtual-model-turn-harness.md`](virtual-model-turn-harness.md)
