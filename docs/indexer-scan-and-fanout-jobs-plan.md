# Plan: Scan job + fan-out list job (queue-safe initial indexing)

## Replace `EnqueueInitialScan`

**`EnqueueInitialScan` is removed** as implemented today (synchronous walk + per-file `Enqueue` loop). Initial indexing is **only** driven by the new queued work:

1. Schedule **one `ScanJob`** (or equivalent entry) instead of calling `EnqueueInitialScan`.
2. **`ScanJob`** produces candidates and enqueues **`FanoutListJob`(s)** — never bulk-enqueues ingest jobs inline.

Optionally keep a **thin API** with a new name (e.g. `ScheduleInitialScan`) whose **sole** responsibility is to **`Enqueue(ScanJob{...})`** once config/matchers are ready, for `cmd/claudia-index` and tests. No code path should retain the old “walk entire tree and flood the queue” behavior.

---

## Implementation status

**Last updated:** reflects the codebase after the scan/fanout indexer work landed (`internal/indexer`, `cmd/claudia-index`, `internal/server/embedui/logs/derive`).

### Summary

| Area | Status |
|------|--------|
| **`WorkItem`** (`WorkIngest`, `WorkScan`, `WorkFanoutList`) + ingest **`Job`** payload | **Done** — `internal/indexer/work.go` |
| **Priority queue** (tiers 1–3, dequeue prefers higher tier; ingest dedup + **tier upgrade** when re-enqueued at higher tier) | **Done** — `internal/indexer/queue.go` |
| **`ScheduleInitialScan`** / removal of **`EnqueueInitialScan`** flood | **Done** — `internal/indexer/indexer.go`, `cmd/claudia-index/main.go` |
| **Scan job:** inventory → walk → **`TaggedCandidate`** → chunked **`FanoutListJob`** | **Done** — `internal/indexer/scan_fanout.go` |
| **Fair-share:** `per_scope_fanout_budget`, **`pending_bulk_by_scope`**, remainder fan-out | **Done** — same; **`N`** = distinct scope keys from **walk-time skips (per-path `IngestHeaders`) ∪ candidates** |
| **Config** `queue_fanout_high_water_mark_percent` (default 75) | **Done** — `internal/indexer/config.go`, `config/indexer.example.yaml` |
| **Watchers:** Write → tier 2, Create → tier 3 (debounced max tier) | **Done** — `internal/indexer/debounce.go`, `internal/indexer/indexer.go` |
| **`initial_scan_complete`** | **Phased behaviour implemented:** set after scan completes and fan-out jobs are **queued** (not after all ingests finish). See `initial_scan_completed` in `internal/indexer/observation.go` / `scan_fanout.go`. |
| **Discovery logs** | **Per-scope:** `indexer.discovery.summary.scope` (+ `rel_paths`, **`paths_truncated`**, **`path_sample_count`**); scan scheduling budget: **`indexer.scan.complete`**. Global **`indexer.discovery.summary`** helper exists in `ops_events.go` but **initial scan no longer emits it** (only scoped summaries + scan complete). |
| **Queue observability** | **`indexer.queue.snapshot`** includes **`queue_depth_bulk`**, **`queue_depth_write`**, **`queue_depth_interactive`** plus total **`queue_depth`**. |
| **Embed UI** | **Partial:** `indexerPresent.js` prose for **`indexer.discovery.summary.scope`** and **`indexer.scan.complete`**; `indexerMetrics.js` minor rollup tweak. **Not verified:** every summarized/story/rollup mode shows a full **card-per-scope** when **`N > 1`**. |
| **Desktop parity** | **Manual** smoke-test only (same gateway embed as web); **not** automated. |
| **Tests** | **Partial:** unit tests for **budget formula**, **priority dequeue**, **tier upgrade** (`queue_test.go`, `scan_fanout_test.go`); integration tests updated for **`ScheduleInitialScan`**. **Missing vs plan:** explicit integration tests for **queue-full during fan-out**, **remainder chains under contention**, **multi-scope starvation**. |
| **Phase 6 (optional)** | **Not done:** `indexer.scope.progress`, formal dedup policy doc beyond upgrade behaviour, **`fsnotify.Remove`** / corpus delete. |
| **Remainder when queue physically full** | **Warn / possible loss** if re-enqueue of remainder **`FanoutListJob`** fails — **no** durable retry loop (plan flagged this risk). |

### Phase checklist (detail)

See [Implementation order (phased)](#implementation-order-phased) — each phase table below includes a **Status** column.

---

## Purpose

Avoid **bounded-queue loss** during initial indexing by splitting work into:

1. **Scan job** — Walk configured tree(s), apply ignores/binary/size rules (same inputs as today’s `Walk`), output a **deduped candidate list** (in memory). Does **not** push one `Job` per file onto the bounded queue.
2. **Fan-out / list job** — Holds a slice of `Candidate` (or equivalent paths). When a worker runs it, it **enqueues normal single-file ingest jobs** until a **per–project+flavor fair-share high-water mark** is reached (see [Fair-share fan-out HWM](#fair-share-fan-out-hwm)), then **enqueues another list job** with the **remainder** of the slice. Repeat until the remainder is empty.

No **new** durable storage: lists live in **queued job payloads** (process memory) until workers drain them. Same constraints as today: if the process crashes before a remainder list job runs, that slice is lost unless you add persistence later.

---

## How the current code actually behaves (alignment check)

> **Note:** This table described **pre-migration** behaviour for planning. After implementation, see **[Implementation status](#implementation-status)** for what ships now.

| Topic | Reality today |
|--------|----------------|
| **`EnqueueInitialScan` (current)** | A **synchronous function**, not a queued job. It calls `Walk` → gets `[]Candidate` → loops `queue.Enqueue(Job{...})` per candidate. **This API goes away** in favor of `ScanJob` + `FanoutListJob` (see above). |
| **What a `Job` is** | Single shape: one file (`Root`, `RelPath`, `AbsPath`). Every dequeued item goes to `processJob` → `ingestOne` (gateway ingest). |
| **Queue** | In-process **FIFO** slice + pending **dedup set** by `Job.Key()` (root id + rel path). **No priority today.** After migration: **tiered dequeuing** (see [Priority rules](#priority-rules-bulk-vs-interactive)); full queue → `Enqueue` returns false → **drops** still possible unless backpressure retries are implemented. |
| **Watch path** | `RunWatchers` debounces fs events and calls the **same** `Enqueue` for **one file** at a time. Same queue as initial scan. |
| **Corpus inventory** | `loadRemoteCorpusInventory` runs **before** the walk in today’s `EnqueueInitialScan`; after migration it runs **inside `ScanJob`** before `Walk`. Ingest skips still use `remoteInv` + sync state **inside** `ingestOne`. |

**Misalignment to avoid:** Treating “initial scan” as if it were already a queue job — it isn’t. The **overload** happens because the scan loop tries to enqueue **all** candidates at once into a **fixed-capacity** queue.

---

## Target architecture (work kinds + priority)

Introduce a **discriminated union** (or separate types + switch) for “work items” the worker pool processes, each carrying a **priority tier** (see [Priority rules](#priority-rules-bulk-vs-interactive)):

### Kind A — `IngestJob` (current behavior)

- Fields: `Root`, `RelPath`, `AbsPath` (today’s `Job`), plus **`priority` tier** (**1** from fan-out, **2** / **3** from watchers — see priority table).
- Handler: existing `processJob` → `ingestOne` (priority does not change ingest semantics, only scheduling).

### Kind B — `ScanJob` (new)

- **Priority:** **Tier 1** (bulk).
- **Inputs:** Same conceptual inputs as today’s per-root scan: `Root` (or list of roots), `IgnoreExtra`/matcher inputs from `Resolved`, `MaxFileBytes`, binary-detection knobs. Optionally a flag “which roots” if you allow partial scans.
- **Behavior:** Run `loadRemoteCorpusInventory` if appropriate (same ordering as today — before producing candidates). For each root: build `Matcher`, call `Walk(root, WalkOptions{...})`, aggregate `[]Candidate`. **Tag each candidate** with **resolved `project` + `flavor`** via **`IngestHeaders(root, relPath)`** (see [Project + flavor aware scans and reporting](#project--flavor-aware-scans-and-reporting)). **Dedup** candidates across roots if overlapping paths are possible (policy TBD). **Do not** enqueue ingest jobs here.
- **Output:** Emit **per–project-flavor discovery reports** (summary + file list per scope). Enqueue **one or more** `FanoutListJob` (**tier 1**) whose payloads partition candidates by scope (or carry scope on each row). Remainder `FanoutListJob`s are also **tier 1**.

### Kind C — `FanoutListJob` (new)

- **Priority:** **Tier 1** (bulk).
- **Payload:** `candidates []Candidate` (each tagged with **project + flavor**), or scope-keyed slices; plus optional metadata (e.g. `generation` for logging).
- **Behavior (single worker execution):** Use **[Fair-share fan-out HWM](#fair-share-fan-out-hwm)** — **not** a single global `queue.Len() >= 75% * cap` for one scope (that would let one project+flavor monopolize the bulk slice and starve others). While iterating `candidates` for this job’s scope:
  - If **this scope’s** pending bulk ingest count would exceed its **`per_scope_fanout_budget`**, **stop**; **enqueue** another `FanoutListJob` with the **remaining** slice; **return**.
  - Else: try `Enqueue(IngestJob{..., tier: 1, scope: …})`. On success, bump **per-scope pending** counter for bulk tier-1 ingests. If **`Enqueue` fails** (queue physically full): remainder → new `FanoutListJob` as today.
  - When a bulk **`IngestJob`** is **dequeued** for processing, **decrement** that scope’s pending counter (or equivalent lifecycle hook).
- If list exhausted: done (no further list job).

**Recursive remainder:** Explicitly supported: each remainder is a **new** `FanoutListJob` on the queue, so workers eventually drain without requiring disk.

---

## Fair-share fan-out HWM

A **global** rule such as “stop when `queue.Len() >= 0.75 * queue_cap`” during fan-out would allow **one** project+flavor’s bulk work to consume almost the entire **bulk headroom**, so **other** scopes’ fan-outs (and user embedding traffic on those collections) see an **empty or stalled queue** for a long time.

Instead:

### Formula

Let:

- `cap` = `queue.Cap()` (configured `queue_depth`),
- `p` = fan-out high-water **fraction** (default **0.75**, configurable e.g. `queue_fanout_high_water_mark_percent`),
- `N` = **number of distinct project+flavor buckets** in play for this indexer run (see below).

**Per-scope bulk fan-out budget** (max pending **tier-1 bulk ingest** jobs **from fan-out** attributed to one `(project, flavor)` before that scope’s `FanoutListJob` yields and enqueues a remainder):

```text
per_scope_fanout_budget = floor(cap * p / max(N, 1))
```

- **`N = 1`:** `per_scope_fanout_budget = floor(cap * p)` — same total bulk headroom as a naive global 75% for a single-scope config; remainder recursion happens **more often** only in the sense that yielding is per-scope (acceptable tradeoff).
- **`N > 1`:** Each scope may hold up to **an equal share** of the **global** `cap * p` “bulk reservation,” so **every** active project+flavor can always make forward progress enqueueing bulk work while multiple scopes are busy.

### Defining `N`

Pick one policy (document in code):

- **`N`** = count of **distinct `(ingest_project, flavor_id)`** keys appearing in the **ScanJob** candidate set after tagging; or
- **`N`** = **`DistinctIndexerTargetKeys`**-style count from resolved config + roots (may slightly over-count if some keys have zero files).

### Accounting

Maintain **`pending_bulk_by_scope[(project, flavor)]`** (or atomic map) **incremented** when a tier-1 bulk **`IngestJob`** from fan-out is **successfully enqueued**, **decremented** when that job is **dequeued** for `processJob` (or when dropped — define consistency). **FanoutListJob** for scope S compares **`pending_bulk_by_scope[S]`** (after hypothetical enqueue) to **`per_scope_fanout_budget`**.

**Interaction with interactive tiers (2 / 3):** Those jobs are **not** charged to **`pending_bulk_by_scope`** (or use a separate pool). Priority dequeue still applies: interactive work can jump ahead; **per-scope bulk budget** only **limits bulk fan-out scheduling**, not total `queue.Len()`.

**Global hard cap:** If **`Enqueue` fails** because the **physical** queue is full, remainder fan-out behavior is unchanged — backpressure still applies.

---

## Project + flavor aware scans and reporting

Indexer YAML already binds each **`Root`** to **`Scope`** (and **`GlobOverrides`** refine **project / flavor / workspace** per **relative path**). Today ingest resolves headers via **`Resolved.scopeForRootPath` / `IngestHeaders`** at **`ingestOne`** time only. **This plan requires moving that resolution earlier** so discovery and reporting are **project + flavor aware**.

### Scan and candidate tagging

- For **every** candidate produced by **`Walk`**, compute **`(project, flavor)`** (and optionally **`workspace_id`**) using the **same** rules as today’s ingest: **`mergeScopeFragment(DefaultScope, root.Scope)`** plus **`GlobOverrides`** matched on **`relPath`** — i.e. reuse **`IngestHeaders(root, relPath)`** (or **`scopeForRootPath`**) when building or partitioning the candidate list.
- **`Candidate`** (or successor struct) should carry **`ScopeFragment`** or resolved **`project` / `flavor`** strings so **`FanoutListJob`** payloads and **`indexer.discovery.summary`** (or replacement events) can be attributed correctly.
- **Dedup** keys for ingest remain **root id + rel path**; **metrics buckets** are keyed by **`(project, flavor)`** (or a stable **`indexer_target_key`** string shared with gateway logs).

### Summary report (what operators see)

Replace the **single global** **`indexer.discovery.summary`** with **per–project-flavor reports** (one structured log event per scope, or one parent event with nested slices — choose based on log size limits):

Each report **must** include:

| Field | Meaning |
|-------|---------|
| **`ingest_project`** / **`flavor_id`** (or equivalent) | Resolved scope for this bucket (same strings sent as **`X-Claudia-Project`** / **`X-Claudia-Flavor-Id`**). |
| **Summary counts** | For that scope: candidates discovered, enqueued to fan-out / ingest pipeline, skipped by queue full, walk-time skips (ignored / binary / oversize), etc. — parallel to today’s **`discoveryAgg`** but **scoped**. |
| **`files`** (or **`rel_paths`**) | **The list of files this scope is working through** for this scan — root-relative paths (and root id if multiple roots) that belong to that **project + flavor** after glob overrides. This is the explicit “what we are indexing” inventory for initial bulk work. |

**Operational constraints:** Very large trees can make a single log line huge. Mitigations (pick one or combine): **cap** paths logged per event with **`paths_truncated: true`** + **`path_sample_count`**, emit **chunked** **`indexer.discovery.summary.part`** events per scope, or provide a **DEBUG** full list and **INFO** summary-only. Document the choice.

### Fan-out and progress

- **`FanoutListJob`** segments should carry **scope metadata** so remainder jobs and optional **progress** logs can say **which** project+flavor backlog is draining.
- Emit **`N`** and **`per_scope_fanout_budget`** in logs when **ScanJob** completes (or at indexer start) so operators can verify [Fair-share fan-out HWM](#fair-share-fan-out-hwm).
- Optional: periodic **`indexer.scope.progress`** with **`project`**, **`flavor`**, **`pending_bulk_for_scope`**, **`per_scope_fanout_budget`**, **`remaining_paths_est`** for UI accuracy from initial snapshot through completion.

---

## Operator UI: summarized logs & desktop (rough per-scope progress)

**Requirement:** Both **(1)** the **summarized log view** on the **website** — gateway-served operator UI, including **`/ui/logs`** in summarized / story / rollup modes — and **(2)** **reports in the desktop app** (the **`claudia desktop`** shell that opens the same gateway UI, e.g. **`/ui/desktop`** Logs or equivalent activity surfaces) must surface a **rough status** of **current project+flavor indexing progress**.

| Surface | Role |
|---------|------|
| **Web `/ui/logs`** (summarized view) | Roll up structured indexer lines into **human-readable per–project+flavor status** (not only raw JSON tail). |
| **Desktop app** | Same content path (webview → gateway): operators see the **same rough progress** in logs / desktop reports without a separate indexer-only binary UI. |

**“Rough”** means: show **which** **`(ingest_project, flavor_id)`** scopes are active, and **approximate** phase/backlog (e.g. *discovery*, *fan-out backlog*, *ingesting*, *caught up*) using fields from **`indexer.scope.progress`**, per-scope discovery summaries, **`indexer.job.ingested`** / skip counters, and **`indexer.state`** when tagged or correlated — **not** a guaranteed accurate percentage unless **`discovered`** vs **`completed`** counts are fully instrumented.

**Data path:** Indexer **stderr** → gateway **`servicelogs`** → **`/ui/logs`** SSE/poll (same for browser and desktop webview). Story/summarized layers in **`internal/server/embedui/logs`** (and related JS) should **parse / bucket** per-scope **`msg`** values so the summarized view is **useful for indexing** — align with [`logs-ui-maintainability-plan.md`](logs-ui-maintainability-plan.md) and extend rollups for **`indexer.*`** scope fields.

**Deliverable:** At minimum, **one summarized line or card per project+flavor** when multiple scopes run (and a sensible single-scope summary when **`N = 1`**).

---

## Startup sequence (no `EnqueueInitialScan`)

Today (`cmd/claudia-index/main.go`): calls **`EnqueueInitialScan`**, which walks and floods the queue — **removed**.

**Proposed:**

1. After gateway config is loaded and the indexer is ready to run workers, call **`ScheduleInitialScan`** (or inline **`queue.Enqueue(ScanJob{...})`**) **once** — **no** `EnqueueInitialScan`. Preference: **queue one `ScanJob`** so the filesystem walk runs as worker-handled work (or runs synchronously inside that job only), not on the main goroutine’s bulk-enqueue loop.

2. **`initial_scan_complete`** semantics: today `EnqueueInitialScan` sets `initialScanCompleted` after the walk. With async jobs you must define completion as either:
   - **Strict:** “Scan job finished **and** all fan-out + ingest jobs derived from that scan finished” (requires counters / wait group — more complex), or
   - **Phased:** Set “scan phase queued” after `ScanJob` completes; keep existing flag when **scan job** completes only (watch may start earlier — document behavior).

Document the choice in operator logs (`indexer.run.progress`).

---

## Queue and dedup keys

- **`IngestJob`:** Keep existing `Key()` for pending dedup (root + rel).
- **`ScanJob`:** Fixed key e.g. `"scan\x00"` + run id, or one key per scheduled scan — **must not** collide with file keys.
- **`FanoutListJob`:** Needs **unique keys** per remainder chunk (e.g. UUID or monotonic id per remainder), otherwise dedup map may incorrectly collapse distinct remainders.

Today’s `pending map[string]struct{}` assumes string keys; extend carefully.

---

## Priority rules (bulk vs interactive)

The **FIFO-only** queue cannot express these rules; implement **explicit priority** on every work item (enum or integer **priority class** stored on `Job` / `WorkItem`).

### Tier ordering (highest first)

| Tier | Name | Sources | Purpose |
|:----:|------|---------|---------|
| **3** | **Interactive — structural** | Filesystem **create** and **delete** events (and any future “corpus remove” jobs tied to delete). | Reflect adds/removals quickly so the index matches the tree. |
| **2** | **Interactive — content** | Filesystem **write** / modify events on existing files (`Write`; optionally debounced coalescing **within** this tier). | Refresh embeddings after edits without starving tier 3. |
| **1** | **Bulk / backfill** | **`ScanJob`**, **`FanoutListJob`**, and **every ingest job** those fan-outs enqueue for initial/catch-up indexing. | Large tree walks must not block interactive work. |

**Rule:** On **`Dequeue`**, the worker pool **must** take the **ready** item with the **maximum tier** (prefer **3** over **2** over **1**). Within the same tier, **FIFO** order is preserved.

### Mapping job kinds to tiers

| Work kind | Tier | Notes |
|-----------|:----:|-------|
| `ScanJob` | **1** | Lowest; discovery can wait behind user-driven FS activity. |
| `FanoutListJob` | **1** | Same as bulk — scheduling more ingest slots from the scan backlog. |
| `IngestJob` enqueued **from** `FanoutListJob` | **1** | Tagged bulk at enqueue time (carry priority in the ingest payload). |
| `IngestJob` enqueued **from** `RunWatchers` — **Create** | **3** | New files jump ahead of bulk. |
| `IngestJob` enqueued **from** `RunWatchers` — **Write** | **2** | Modified files beat bulk; loses to create/delete if queue contended. |
| `IngestJob` enqueued **from** `RunWatchers` — **Remove / delete** | **3** | Same tier as create if the operation is “drop indexed doc” or tombstone; if delete is not yet modeled, add **`RemoveJob`** / ingest-delete API **before** relying on this row (today’s watcher path focuses on **Create\|Write** — extend fsnotify handling as needed). |

### Dedup vs priority

If the **same path** is pending twice at **different** tiers (e.g. bulk ingest queued, then user saves the file), policy options:

- **Upgrade priority:** replace pending lower-tier entry with higher-tier **or** bump priority in place (requires queue structure that supports update-by-key).
- **Strict FIFO within tier only:** simpler dequeuer; may briefly duplicate work — resolve with existing ingest idempotency / sync state.

Document the chosen policy when implementing (your note: dedup details later).

### Implementation sketch

- **Option A — Three internal FIFO queues** (`bulk`, `interactive_write`, `interactive_create_delete`): `Dequeue` checks create/delete queue, then write, then bulk. **Fan-out HWM** uses **[per-scope fair-share budget](#fair-share-fan-out-hwm)** — **not** global `queue.Len() >= 0.75 * cap` for a single scope’s list job.
- **Option B — One slice + priority heap** / ordered structure: more complex; use if memory or key updates require it.

---

## Interaction with `RunWatchers`

Watchers enqueue **ingest** (and eventually **remove**) jobs with **tier ≥ 2** (see table above). **Bulk** `ScanJob` / `FanoutListJob` / fan-out **ingest** use **tier 1**.

**Interaction:** When the shared queue is **priority-aware**, file changes **preempt** bulk work in the sense that workers **drain** high-tier items first. **Fan-out** uses **[fair-share per-scope bulk budget](#fair-share-fan-out-hwm)** so no single project+flavor monopolizes bulk headroom; if **`Enqueue` fails** because the **physical** queue is at **`queue_cap`**, use backpressure and retry or re-enqueue with the same tier.

**Current code gap:** `RunWatchers` only arms **Create\|Write**; **delete** (tier 3) must be **added** if “remove from index” is part of the product, or the delete row in the table applies only after that exists.

**Deliverable order:** Implement **queue-safe fan-out (tier-1 bulk)** first if needed, then add **priority dequeuing** and tag watcher enqueues with **2** and **3**.

---

## What changes (code touch list)

Implement in **[Implementation order (phased)](#implementation-order-phased)** — the list below is a **flat inventory** of affected areas, not the sequence of work.

1. **`internal/indexer/queue.go` / job model:** Extend `Job` (or rename to `WorkItem`) with **kind** enum + payload structs + **`priority` tier** (1 / 2 / 3). Replace single FIFO with **priority-aware `Dequeue`** (three FIFO lanes or equivalent); **`Enqueue`** accepts tier. Same **`Key()`** dedup semantics extended so tier-upgrade rules are explicit.

2. **`processJob`:** Dispatch on kind — `Ingest` → existing path; `Scan` → walk + enqueue `FanoutListJob`; `FanoutList` → fan-out loop + possibly enqueue next `FanoutList`. Maintain **`pending_bulk_by_scope`** (increment on enqueue of tier-1 bulk ingest from fan-out, decrement on dequeue / drop) for [Fair-share fan-out HWM](#fair-share-fan-out-hwm).

3. **`EnqueueInitialScan`:** **Delete** the current implementation. Add **`ScheduleInitialScan`** (or equivalent) that **only** enqueues a **`ScanJob`** (and does not walk or bulk-enqueue ingests). Replace global **`indexer.discovery.summary`** with **per–project-flavor** discovery reports (summary counts + file list per scope) emitted from **`ScanJob`** — see [Project + flavor aware scans and reporting](#project--flavor-aware-scans-and-reporting).

4. **`cmd/claudia-index/main.go`:** Replace **`EnqueueInitialScan`** calls with **`ScheduleInitialScan`** (or direct `ScanJob` enqueue). Startup no longer uses a synchronous full-tree enqueue loop — timing of logs and when `initial_scan_completed` flips must match the chosen semantics above.

5. **Tests:** Queue full + **per-scope** fair-share HWM + remainder chaining; multi-scope configs do not allow one scope to block another’s bulk budget; **`N = 1`** behavior matches **`floor(cap * p)`** budget.

6. **Config:** Optional `queue_fanout_high_water_mark_percent` (default **75**, i.e. `p = 0.75` in [Fair-share fan-out HWM](#fair-share-fan-out-hwm)). Optional **priority** toggles if you need to disable tiering in tests.

7. **`RunWatchers`:** Pass **fsnotify op** (or derived tier) into **`Enqueue`** for ingest jobs; add **Remove** handling if tier-3 delete is required (may be a follow-up if API is not ready).

8. **Gateway UI / logs:** Update **`embedui/logs`** (summarized / story / rollup) so **[Operator UI](#operator-ui-summarized-logs--desktop-rough-per-scope-progress)** shows **rough per–project+flavor indexing progress** from structured indexer events; verify parity in **desktop** webview.

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| **Huge `[]Candidate` in one `ScanJob`** | Stream roots into multiple `FanoutListJob`s from scan without materializing one giant slice; or cap slice size and chain scan sub-jobs per directory. |
| **Memory** | Remainder lists duplicate slices — acceptable per product choice; watch peak RSS on large trees. |
| **Worker stuck on long fan-out** | Fan-out job should only **enqueue** (cheap) and yield; heavy work stays in **ingest** jobs. Optionally bound “max ingests scheduled per fan-out execution” (time slice). |
| **Crash mid-backlog** | Same as today — no persistence; user accepts until WAL/checkpoint added. |
| **`initial_scan_complete` / UI** | Define semantics and update any consumer expecting synchronous completion. |
| **Huge path lists in logs** | Cap, chunk, or DEBUG-only full **`files`** per scope; see [Project + flavor aware scans and reporting](#project--flavor-aware-scans-and-reporting). |
| **`N` or pending counters wrong** | Mis-sized fair-share budget or leaks in **per-scope pending** → unfair scheduling or premature yield; add tests and assert monotonic **pending_bulk_by_scope** under load. |

---

## Summary feedback

- **You’re aligned** that the fix is **not** “bigger queue only” but **not flooding** the queue during discovery; **chunked fan-out with remainder jobs** matches the bounded queue without extra storage.
- **Misalignment:** Calling **`EnqueueInitialScan` a job** — it isn’t; the plan **removes** it and uses **`ScanJob` + `FanoutListJob`** so discovery and fan-out are **actual** queued work and **backpressure** applies.
- **Gap:** Current **`Job` + `processJob`** are **ingest-only**; extending them is **required**. **Priority** (tiers **1 / 2 / 3**) is **specified** in [Priority rules](#priority-rules-bulk-vs-interactive) and implemented via queue + watcher tagging.
- **Reporting:** Discovery and summaries become **per project + flavor**, each including **summary counts** and the **list of files** in scope for that scan — see [Project + flavor aware scans and reporting](#project--flavor-aware-scans-and-reporting).
- **Fair-share HWM:** Bulk fan-out uses **`per_scope_fanout_budget = floor(cap * p / N)`** so multiple project+flavor scopes **share** the bulk slice of the queue; **`N = 1`** matches the old single-scope headroom with more frequent remainder jobs — see [Fair-share fan-out HWM](#fair-share-fan-out-hwm).
- **Operator UI:** **[Summarized logs & desktop](#operator-ui-summarized-logs--desktop-rough-per-scope-progress)** must show **rough** per–project+flavor indexing progress on the **website** and in the **desktop app**.

---

## Implementation order (phased)

Work proceeds **in phase order** unless a note says otherwise. Each phase should be **mergeable** (tests green) before starting the next.

### Phase 1 — Work-item model and dispatch

**Status: Done**

| Step | Deliverable | Status |
|------|-------------|--------|
| 1.1 | Introduce **`WorkItem` / extended `Job`**: kind enum (**`Ingest`**, **`Scan`**, **`FanoutList`**) and payloads. **`Ingest`** keeps today’s file fields. | **Done** (`work.go`; ingest fields remain **`Job`**) |
| 1.2 | **`Enqueue` / `Key()`:** Distinct keys for **`ScanJob`** and **`FanoutListJob`** so dedup does not collapse meta-jobs ([Queue and dedup keys](#queue-and-dedup-keys)). | **Done** (`scan\x00…`, `fanout\x00…` + monotonic id) |
| 1.3 | **`processJob`:** Dispatch on kind — **`Ingest`** → existing **`ingestOne`** path; stubs or minimal **`Scan`** / **`FanoutList`** handlers (can noop until Phase 2). | **Done** (`processWorkItem` → **`runScanJob`** / **`runFanoutList`** / **`processIngestWithRetries`**) |
| 1.4 | **Config:** Add **`queue_fanout_high_water_mark_percent`** (default **75**) for **`p`** in [Fair-share fan-out HWM](#fair-share-fan-out-hwm). | **Done** |

**Exit criteria:** Binary builds; existing single-kind ingest tests still pass or are updated.

---

### Phase 2 — Project+flavor tagging and discovery reporting

**Status: Done**

| Step | Deliverable | Status |
|------|-------------|--------|
| 2.1 | For each **`Walk`** candidate, compute **`IngestHeaders(root, relPath)`** and attach **project + flavor** to **`Candidate`** (or successor struct). | **Done** (**`TaggedCandidate`**) |
| 2.2 | **Compute `N`** (distinct scopes in candidate set or config — pick one policy and document). | **Done** — **`N`** = distinct scope keys from **candidates ∪ walk skips** (per-path headers). |
| 2.3 | Replace one-shot global discovery log with **per–project-flavor** reports: **summary counts** + **`files`** (with [size/truncation policy](#summary-report-what-operators-see)). | **Done** — **`indexer.discovery.summary.scope`** with **`rel_paths`** capped (**200** paths, **`paths_truncated`**, **`path_sample_count`**). |

**Exit criteria:** Structured logs prove **scoped** discovery with correct buckets on multi-root / glob-override configs.

---

### Phase 3 — `ScanJob`, `FanoutListJob`, fair-share, replace `EnqueueInitialScan`

**Status: Mostly done** (step 3.5 tests **partial**)

| Step | Deliverable | Status |
|------|-------------|--------|
| 3.1 | **`ScanJob`:** Run **`loadRemoteCorpusInventory`**, **`Walk`** per root, aggregate tagged candidates; enqueue **`FanoutListJob`** payload(s) — **no** per-file ingest flood. | **Done** (fan-out lists chunked to **4096** candidates per job) |
| 3.2 | **`pending_bulk_by_scope`** + **`per_scope_fanout_budget = floor(cap × p / max(N,1))`**; **`FanoutListJob`** enqueues tier-1 **`IngestJob`s** until scope budget hit → **remainder** `FanoutListJob` ([Fair-share fan-out HWM](#fair-share-fan-out-hwm)). | **Done** |
| 3.3 | **Delete `EnqueueInitialScan`**; add **`ScheduleInitialScan`** that only **`Enqueue(ScanJob)`**. Wire **`cmd/claudia-index`** and **`internal/indexer`** tests. | **Done** |
| 3.4 | Define and implement **`initial_scan_complete`** / **`indexer.run.progress`** semantics ([Startup sequence](#startup-sequence-no-enqueueinitialscan)). | **Done** — **phased:** flag after scan + fan-out **enqueue**; progress logs **`scan_scheduled`**, **`initial_scan`**, **`indexer.scan.complete`**. |
| 3.5 | **Tests:** Queue physically full + **per-scope** fair-share + remainder chains; **`N = 1`** matches **`floor(cap × p)`** budget; multi-scope does not starve. | **Partial** — budget formula + integration **`ScheduleInitialScan`** covered; **missing** dedicated tests for queue-full remainder chains and multi-scope contention. |

**Exit criteria:** Large trees no longer lose bulk candidates solely due to single-scope monopolization of a global 75% cap; core indexer workflow complete for **bulk tier 1 only**.

---

### Phase 4 — Priority tiers and watchers

**Status: Done** (Remove/deferred)

| Step | Deliverable | Status |
|------|-------------|--------|
| 4.1 | Add **`priority`** (1 / 2 / 3) to work items; implement **priority-aware `Dequeue`** ([Priority rules](#priority-rules-bulk-vs-interactive), [Implementation sketch](#implementation-sketch)). | **Done** (**`PriorityTier`**, three lanes) |
| 4.2 | Tag **`ScanJob` / `FanoutListJob` / fan-out `IngestJob`** as **tier 1**. | **Done** |
| 4.3 | **`RunWatchers`:** pass event op → **tier 2** (Write) / **tier 3** (Create); optional **Remove** later if product/API ready. | **Done** for Create/Write; **`Remove`** **not** implemented |
| 4.4 | **Tests:** Under load, **tier 3** dequeues before **tier 1** backlog; fair-share and **`Enqueue`** failure paths still behave. | **Partial** — **`TestQueue_DequeuePrefersInteractiveTier`** + **`TestQueue_IngestTierUpgrade`**; **no** dedicated test for enqueue-failure during fan-out. |

**Exit criteria:** Interactive filesystem work preempts bulk per the tier table.

---

### Phase 5 — Operator UI (website + desktop)

**Status: Partial**

| Step | Deliverable | Status |
|------|-------------|--------|
| 5.1 | **`embedui/logs`:** Summarized / story / rollup recognizes per-scope **`indexer.*`** fields and shows **[rough per-scope progress](#operator-ui-summarized-logs--desktop-rough-per-scope-progress)**. | **Partial** — **`indexerPresent.js`** (+ **`indexerFlatMsg`**) handles **`indexer.discovery.summary.scope`** and **`indexer.scan.complete`**; **`indexerMetrics.js`** rolls scoped discovery into ignore-metrics where applicable. **Gap:** not every summarized/story/rollup path verified for **one card per scope** when **`N > 1`**. |
| 5.2 | **Desktop webview:** Smoke-test parity with web **`/ui/logs`** on the same gateway session. | **Not automated** — same embed as desktop; manual smoke only. |

**Exit criteria:** Operators see **one rough status per project+flavor** (when **`N > 1`**) in summarized view on **both** surfaces.

---

### Phase 6 — Hardening and follow-ups

**Status: Optional follow-ups** (6.1/6.3 not done; 6.2 = **code-only** tier upgrade)

| Step | Deliverable | Status |
|------|-------------|--------|
| 6.1 | Optional **`indexer.scope.progress`** periodic logs for finer UI ([Fan-out and progress](#fan-out-and-progress)). | **Not done** |
| 6.2 | **Dedup vs priority upgrade** policy ([Dedup vs priority](#dedup-vs-priority)) if races appear in production. | **Behaviour implemented** in **`queue.go`**; **no** separate operational runbook / ADR (still optional hardening). |
| 6.3 | **Tier 3 delete** path end-to-end if **Remove** ingest/corpus API lands ([Interaction with `RunWatchers`](#interaction-with-runwatchers)). | **Not done** |

---

### Dependency diagram (summary)

```text
Phase 1 (model + dispatch)
    → Phase 2 (scope tagging + discovery logs)
        → Phase 3 (Scan/Fanout/fair-share + ScheduleInitialScan)  ← MVP indexer complete
            → Phase 4 (priority + watchers)
                → Phase 5 (UI)
                    → Phase 6 (polish / optional)
```

---

## Handoff: notes for the next agent / things to ask the owner

This section is **intentionally explicit** so another implementer does not have to rediscover context from chat history.

### Facts another agent should assume (unless code contradicts)

| Topic | Note |
|-------|------|
| **Queue storage** | The indexer queue is **in-memory only** (`internal/indexer/queue.go`). Restart loses pending jobs; remainder **`FanoutListJob`** payloads are not persisted. |
| **Scope resolution** | Per-file **`project` / `flavor`** must match ingest: **`Resolved.IngestHeaders` / `scopeForRootPath`** (`internal/indexer/scope.go`). Do not invent parallel rules. |
| **`N` for fair-share** | **Implemented:** **`N`** is fixed for a run from the **union** of scopes seen during walk (skips + candidates). **`indexer.scan.complete`** logs **`n_scopes`** and **`per_scope_fanout_budget`**. |
| **Gateway logs pipeline** | Operator UI reads indexer output via **gateway `servicelogs`** (indexer stderr tee’d in `cmd/claudia/serve.go`). New structured fields must remain **JSON-log-parseable** from that stream for **`/ui/logs`**. |
| **Desktop vs web** | Desktop uses the **same** gateway **`/ui/logs`** embed — UI work is **not** duplicate native widgets unless product asks otherwise. |
| **`initial_scan_complete`** | **Implemented as phased:** flips after **`ScanJob`** completes and **`FanoutListJob`** work is **queued** (see **`runScanJob`** / **`initialScanCompleted`**). **`indexer.state`** may show **`backlog`** / **`uploading`** while bulk ingests continue. |
| **BiFrost / Qdrant** | This plan touches **`internal/indexer`** and gateway **embed UI** only unless ingest APIs change; gateway **ingest** handlers are unchanged unless delete/remove scope is added in Phase 6. |

### Open decisions — **ask the owner** if not specified elsewhere

Resolved in code (see [Implementation status](#implementation-status)):

1. **`N` policy:** **Resolved** — **`N`** = number of distinct scope keys from **walk skips** (per-path **`IngestHeaders`**) **plus** tagged candidates (union). Logged as **`n_scopes`** on **`indexer.scan.complete`**.
2. **Discovery **`files`** list in logs:** **Resolved** — INFO **`rel_paths`** capped (**200**), with **`paths_truncated`** and **`path_sample_count`**.
3. **`initial_scan_complete` semantics:** **Resolved — phased:** flag flips after scan finishes and fan-out list jobs are **enqueued** (not when all bulk ingests complete).
4. **Priority vs dedup collision:** **Resolved** — **tier upgrade:** enqueueing the same ingest key at a **higher** tier **replaces** the pending lower-tier item (`internal/indexer/queue.go`).

Still open / deferred:

5. **Remove / tier 3:** **`fsnotify.Remove`** and corpus delete — **deferred** (watchers still **Create|Write** only for enqueue).
6. **Fair-share when interactive dominates:** If physical queue is full, remainder **`FanoutListJob`** re-enqueue may **fail** — currently **warn** / possible **loss**; **no** infinite retry loop (revisit if production shows starvation).

### Implementation hazards (watchlist)

- **`pending_bulk_by_scope`** must stay consistent across **enqueue**, **dequeue**, **failed ingest drop**, and **priority upgrade** evictions — leaks distort fair-share.
- **Multi-lane priority `Dequeue`** + **`Len()`** — **`indexer.queue.snapshot`** exposes total **`queue_depth`** plus **`queue_depth_bulk`**, **`queue_depth_write`**, **`queue_depth_interactive`**.
- **Tests:** Prefer **`internal/indexer`** integration-style tests with fake **`GatewayClient`** (patterns exist in `indexer_test.go`) before relying only on E2E.

### Related docs in this repo

| Doc | Why |
|-----|-----|
| [`logs-ui-maintainability-plan.md`](logs-ui-maintainability-plan.md) | Logs UI architecture when editing **`embedui/logs`**. |
| [`log-view-indexer.plan.md`](log-view-indexer.plan.md) | Indexer-specific log / UX notes if present. |
| [`docs/indexer.md`](indexer.md) (if present) | Operator-facing indexer behavior. |

### When to stop and ask the owner

- Changing **`queue_depth`** defaults or **fair-share formula** after UX promises were made.
- Adding **durable** queue persistence (SQLite, etc.) — **out of scope** for this plan; separate ADR.
- **Breaking** changes to **`indexer.discovery.summary`** field names without a migration window for log parsers or dashboards.

---

*End of plan document.*
