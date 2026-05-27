# Plan: Chimera-embed operator logs and service card

| Field | Value |
|-------|-------|
| **Doc kind** | `feature-plan` |
| **Owners / areas** | Gateway embed UI (`adminui/embed/embedui/settings`), operator copy (`internal/operatorcopy`), naming contracts (`internal/naming`), embed wrapper (`chimera-embed`, `internal/wrapper`), supervisor (`chimera-supervisor`), servicelogs ingest |
| **Status** | `draft` |
| **Targets** | Gateway desktop v0.3 — completes operator visibility for [internal embedding provider](internal-embedding-provider.md) after runtime/default-config shipped |
| **Last updated** | See git history |
| **Supersedes / superseded by** | Extends [`internal-embedding-provider.md`](internal-embedding-provider.md) (runtime only); does not replace [`log-qdrant.md`](log-qdrant.md) or [`log-bifrost.md`](log-bifrost.md) |

## At a glance

**chimera-embed** (wrapper + **llama-server**) is supervised, on by default, and writes to the operator log ring buffer — but the Settings summarized feed has **no embed service card**, **no `embed.*` operator-copy mappings**, and **no generated UI contracts** entry. Operators see raw `embed.upstream.line` rows with nested JSON in `detail` (for example missing GGUF at `data/embedding/models/nomic-embed-text.gguf`) instead of plain-language headlines like broker and vectorstore cards.

This plan adds the missing **log taxonomy**, **ingest normalization**, **operator copy**, and **summarizedFeed service card** so embed parity matches **chimera-broker** / **chimera-vectorstore**.

**Related docs:** [`internal-embedding-provider.md`](internal-embedding-provider.md), [`log-qdrant.md`](log-qdrant.md), [`log-bifrost.md`](log-bifrost.md), [`embedui-component-system.md`](embedui-component-system.md), [`configuration.md`](../configuration.md).

| Phase | Outcome | Status |
|-------|---------|--------|
| [Phase 1 — Spec and frozen taxonomy](#phase-1--spec-and-frozen-taxonomy) | Locked `embed.*` slug list, routing rules, and card UX contract | `todo` |
| [Phase 2 — Go contracts and operator copy](#phase-2--go-contracts-and-operator-copy) | `internal/naming`, `messages.yaml`, codegen, supervisor embed slugs | `todo` |
| [Phase 3 — Ingest normalization hardening](#phase-3--ingest-normalization-hardening) | Structured subprocess + wrapper lines; fewer `embed.upstream.line` catch-alls | `todo` |
| [Phase 4 — Settings contracts and log routing](#phase-4--settings-contracts-and-log-routing) | `contracts.js`, bucket order, dirty routing, badges | `todo` |
| [Phase 5 — SummarizedFeed service card](#phase-5--summarizedfeed-service-card) | Collapsed/expanded **chimera-embed** card with metrics, KV, intro, event log | `todo` |
| [Phase 6 — Gateway overview and health](#phase-6--gateway-overview-and-health) | Embed row in gateway health strip + supervisor/overview payload | `todo` |
| [Phase 7 — Tests, gallery, and docs](#phase-7--tests-gallery-and-docs) | Goja tests, component gallery sample, plan closeout | `todo` |

---

## Background

### What already shipped (runtime)

The **internal embedding provider** train delivered process supervision and config, not operator UI:

| Layer | Status |
|-------|--------|
| **chimera-embed** wrapper | Built; uses shared `internal/wrapper/runtime` with `ComponentEmbed`, `embed.ready`, `/debug/embed/logs` |
| **llama-server** backend | Pinned in `chimera/deps.lock` (`LLAMA_CPP_RELEASE`); installed via `make chimera-embed-install` (full runtime bundle on Windows) |
| **Supervisor** | Starts embed after vectorstore when `internal_embedding.enabled` (default **true**); `-embed-listen` `127.0.0.1:7750`, backend `127.0.0.1:8090` |
| **Config** | `internal_embedding` in `gateway.yaml`; RAG rewired to `internal/nomic-embed-text` @ `http://127.0.0.1:8090` |
| **Data dirs** | `make chimera-embed-configure` → `data/embedding/models/`, `data/embedding/cache/` |
| **Log source** | `servicelogs.SourceChimeraEmbed` = `"chimera-embed"` (`chimera/internal/servicelogs/sources.go`) |
| **Indexer health** | `buildInternalEmbeddingCheck` probes embed endpoint when model uses internal provider prefix |

### What is missing (operator UI + contracts)

Compared to **chimera-broker** and **chimera-vectorstore**:

| Area | Broker / vectorstore | chimera-embed today |
|------|----------------------|---------------------|
| `internal/naming/gateway_logs.go` | `LogSourceChimeraBroker`, `LogSourceChimeraVectorstore`, `LogMsgPrefix*` | **No** `LogSourceChimeraEmbed`, **no** `LogMsgPrefixEmbed` |
| `internal/naming/log_messages.go` | Dozens of `Msg*` constants | **No** `embed.*` or `gateway.supervisor.embed.*` |
| `internal/operatorcopy/messages.yaml` | Full slug registry + formatters | **Zero** `embed.*` entries |
| `embedui/settings/contracts.js` (generated) | Product + log source + timeline bar | **No** `ProductEmbed` / `LogSourceChimeraEmbed` |
| `summarizedFeed.js` service cards | `chimera-broker`, `chimera-vectorstore`, `chimera-gateway`, `chimera-indexer` | **No** `chimera-embed` |
| `summarizedDirtyRouting.js` | Bucket + `entryIsVectorstoreLine` helpers | **No** embed bucket / line classifier |
| `operatorMessageServices.js` | Broker + vectorstore formatters | **No** embed formatter |
| Derive module | `chimeraBrokerMetrics.js`, `vectorstoreRagMetrics.js` | **No** `chimeraEmbedMetrics.js` |
| Gateway overview health strip | broker, vectorstore, indexer rows | **No** embed row |
| Supervisor health slog | `chimera-supervisor.chimera-broker.ready`, etc. | **No** embed starting/ready slog (health monitor logs `"embed"` only) |
| Gallery / CSS | `sum-av-svc-chimera-broker`, vectorstore tints | **No** embed avatar / badge classes |

### Observed log shape today (why operators are confused)

From `data/locus-desktop-supervisor.log` when GGUF is missing:

```json
{"detail":"{\"time\":\"…\",\"msg\":\"starting backend\",\"component\":\"chimera-embed\",\"msg\":\"wrapper.backend.starting\",…}","level":"INFO","msg":"embed.upstream.line","service":"chimera-embed"}
{"detail":"chimera-embed: start llama-server: llama-server model missing at …\\data\\embedding\\models\\nomic-embed-text.gguf: …","level":"INFO","msg":"embed.upstream.line","service":"chimera-embed"}
```

Problems for UI work:

1. **Wrapper lifecycle** slugs (`wrapper.backend.starting`, `wrapper.backend.restarting`) arrive **inside** `detail` as nested JSON, not as top-level `msg`.
2. **Actionable errors** (missing model path, binary missing) are plain text in `detail` with generic `embed.upstream.line`.
3. **`embedline/normalize.go`** only special-cases lines containing `"listening"` → `embed.llama_server.listening`; everything else is `embed.upstream.line`.

### Related but distinct log families (do not conflate)

| Slug / source | Meaning | Target card |
|---------------|---------|-------------|
| `embed.*` / `service: chimera-embed` | Wrapper + llama-server subprocess | **chimera-embed** (this plan) |
| `rag.embed` / gateway | Gateway RAG client latency when calling embedding URL | **chimera-gateway** (existing); optional cross-link on embed card |
| `chimera-broker` + `POST /v1/embeddings` | Legacy Ollama/broker path when internal embedding off | **chimera-broker** |
| `gateway.supervisor.*` | Supervisor wait/ready for children | **chimera-gateway** overview |

When internal embedding is default-on, ingest/indexer traffic should **not** appear on the broker card for embeddings; the embed card should show subprocess health and (optionally) gateway `rag.embed` counters.

### Architecture reference (for implementers)

```
chimera-supervisor
  └─ chimera-embed (wrapper, :7750 /readyz)
       └─ llama-server --embedding (:8090 /v1/embeddings)
chimera-gateway / chimera-indexer
  └─ ragembed → internal_embedding.base_url (8090)
```

Key paths:

- Wrapper normalize: `chimera/chimera-embed/internal/embedline/normalize.go`
- Wrapper config messages: `chimera/chimera-embed/main.go` (`embed.ready`, `embed.http.server_error`)
- Shared wrapper slugs: `chimera/internal/wrapper/runtime/runtime.go` (`wrapper.backend.starting`, …)
- Supervisor embed child: `chimera/chimera-supervisor/internal/supervise/children.go` (`startEmbedChild`)
- UI feed: `chimera/chimera-gateway/internal/server/adminui/embed/embedui/settings/app/summarizedFeed.js`
- UI routing: `…/settings/app/summarizedDirtyRouting.js`
- Generated contracts: `…/settings/contracts.js` ← `make operator-contracts-generate` from `internal/naming`

---

## Phase 1 — Spec and frozen taxonomy

**Goal.** Lock slug names, field shapes, and card behavior before code changes — mirror the structure of [`log-qdrant.md`](log-qdrant.md) Phase 1.

**Deliverables**

- Canonical **`embed.*`** taxonomy table (wrapper + llama-server + gateway-adjacent).
- Locked decisions table (counter window, card visibility, badge suppression, dual routing with `rag.embed`).
- UI contract sketch: collapsed subtitle, KV row, mini-cards/counters, expanded intro paragraph (parallel broker/vectorstore intros in `summarizedFeed.js`).

**Acceptance**

- Reviewer can answer: which slug fires for missing GGUF, for ready, for restart loop, for HTTP embedding request (if logged).
- Card visibility rule documented: show when `internal_embedding.enabled` **or** any `chimera-embed` lines in buffer (TBD in open questions).

**Status:** `todo`

### Proposed canonical `msg` taxonomy (draft — freeze in Phase 1)

**Wrapper-origin** (emitted by `chimera-embed` / shared wrapper runtime; normalize in `embedline`, not nested in `detail`):

| `msg` | Detection | Operator headline / KV |
|-------|-----------|-------------------------|
| `embed.startup.banner` | First supervised line / wrapper start | Subtitle: **Starting embed runtime…**; resets counter window |
| `embed.ready` | Wrapper readiness (`ReadyMessage` in `main.go`) | Subtitle: **Ready**; KV **wrapper** = `127.0.0.1:7750` |
| `embed.version` | Wrapper status payload with version/build | KV **wrapper version** |
| `embed.backend.starting` | Map from `wrapper.backend.starting` | Subtitle: **Starting llama-server…** |
| `embed.backend.restarting` | Map from `wrapper.backend.restarting` | Subtitle: **Restarting llama-server**; counter **restarts** |
| `embed.backend.readiness_failed` | Map from `wrapper.backend.readiness_failed` / startup timeout | Subtitle: **Backend not ready**; KV **last error** |
| `embed.backend.model_missing` | `llama-server model missing at` in stderr | Subtitle: **Missing GGUF weights**; KV **model_path** (basename only) |
| `embed.backend.binary_missing` | `start llama-server:` / executable not found | Subtitle: **llama-server not found** — run `make chimera-embed-install` |
| `embed.llama_server.starting` | Structured slog from `llamaserver/start.go` | KV **backend** = llama-server, **model** basename |
| `embed.llama_server.listening` | llama-server "listening" / HTTP ready on `:8090` | KV **endpoint** = `127.0.0.1:8090` |
| `embed.http.server_error` | Wrapper HTTP server error (`HTTPServerErrorMessage`) | Counter **wrapper errors** |
| `embed.http.access` | Future: if wrapper logs proxied `/v1/embeddings` access | Counter 2xx/4xx/5xx (optional Phase 3+) |
| `embed.shutdown` | Graceful wrapper shutdown | Subtitle: **Shutting down** |
| `embed.unparsed` | Non-JSON or unknown llama-server line | Raw in `detail`; no counter advance |

**Supervisor-origin** (gateway-visible via supervisor log stream / mirror):

| `msg` | Detection | Maps from |
|-------|-----------|-----------|
| `gateway.supervisor.embed.starting` | Wait for `/readyz` begins | New slog in `supervise/health.go` or `children.go` |
| `gateway.supervisor.embed.ready` | Embed `/readyz` OK | Parallel `chimera-supervisor.chimera-broker.ready` |
| `gateway.supervisor.embed.failed` | Wait timeout / start error | Parallel broker/vectorstore failure paths |

**Gateway-origin** (optional cross-display on embed card):

| `msg` | Notes |
|-------|--------|
| `rag.embed` | Already exists; show **client latency** strip or counter on embed card when `embedding_base_url` is internal |

### Locked decisions (proposed — confirm in Phase 1)

| Topic | Proposal |
|-------|----------|
| Slug prefix | **`embed.*`** for subprocess + wrapper (parallel **`vectorstore.*`** / **`broker.*`**) |
| Normalization location | **On ingest:** extend `chimera/chimera-embed/internal/embedline/normalize.go`; unwrap nested JSON wrapper lines before classifying |
| Counter window | Lines **after last `embed.startup.banner` or `embed.ready`** (mirror vectorstore `qdrant.version` window) |
| Card when disabled | Hide **chimera-embed** card when `internal_embedding.enabled: false` **and** no embed lines in buffer |
| Badge in own panel | **Suppress** `chimera-embed` source badge inside embed expanded panel (mirror `suppressVectorstoreBadge`) |
| `rag.embed` routing | Keep primary bucket **gateway**; embed card may **summarize** recent `rag.embed` counts via derive helper reading gateway lines |
| Model path in UI | Show **basename** + link hint to `data/embedding/models/`; never log full secrets |

---

## Phase 2 — Go contracts and operator copy

**Goal.** Every frozen slug has a Go constant, registry row, and generated JS operator headline.

**Deliverables**

- Add to `internal/naming/gateway_logs.go`: `LogSourceChimeraEmbed`, `LogMsgPrefixEmbed`, optional `TimelineKindEmbed`.
- Add `MsgEmbed*` / `MsgGatewaySupervisorEmbed*` to `internal/naming/log_messages.go` (or extend `go generate` from `messages.yaml`).
- Add **`embed.*`** and **`gateway.supervisor.embed.*`** sections to `internal/operatorcopy/messages.yaml` with summaries + formatter keys.
- Run `make operator-contracts-generate` → updates `embedui/settings/contracts.js` and `operator_copy.js`.
- Supervisor: emit `gateway.supervisor.embed.starting` / `.ready` / `.failed` in `chimera-supervisor/internal/supervise/health.go` (mirror broker/vectorstore).
- Add alias map entries in `operator_copy.js` slug migration table (already has broker/vectorstore supervisor aliases).

**Acceptance**

- `go test ./internal/naming/... ./internal/operatorcopy/...` pass.
- `make operator-contracts-check` pass.
- Sample log lines from Phase 3 produce non-empty headlines via `operatorMessage` formatters in Goja tests.

**Status:** `todo`

---

## Phase 3 — Ingest normalization hardening

**Goal.** Stop dumping wrapper JSON into `detail`; emit stable top-level `msg` + structured fields for UI derive.

**Deliverables**

- Extend `embedline.NormalizePayload`:
  - If line is JSON with `wrapper.*` or `component: chimera-embed`, map to `embed.*` slugs (see taxonomy).
  - Parse **model missing**, **binary missing**, **listen** patterns from llama-server text.
  - Emit `embed.unparsed` only as last resort.
- Optionally: teach wrapper runtime to prefix embed-specific slugs instead of generic `wrapper.*` when `ComponentEmbed` (lower churn in embedline if done here — pick one place in Phase 1).
- Unit tests: `chimera/chimera-embed/internal/embedline/*_test.go` with fixtures from `data/locus-desktop-supervisor.log` (sanitized paths).

**Acceptance**

- Missing GGUF produces **`embed.backend.model_missing`** with `model_path` field, not nested `wrapper.backend.starting` inside `detail`.
- Ready line produces **`embed.ready`** visible in ring buffer JSON.

**Status:** `todo`

---

## Phase 4 — Settings contracts and log routing

**Goal.** Summarized feed can **bucket** embed lines without misrouting to broker/gateway.

**Deliverables**

- Regenerated `contracts.js`: `ProductEmbed: "chimera-embed"`, `LogSourceChimeraEmbed`, timeline bar entry `{ key: "chimera-embed", label: "embed" }`, `serviceBadgeClass` → `sum-svc-embed`.
- `summarizedDirtyRouting.js`:
  - Add **`chimera-embed`** to `SERVICE_BUCKET_ORDER`.
  - Implement **`entryIsEmbedLine(ent, getFlat)`**: `service === chimera-embed`, `msg` prefix `embed.`, source `chimera-embed`.
  - Ensure broker bucket does **not** capture internal embed traffic (no false `POST /v1/embeddings` on broker when base URL is `:8090`).
- `summarized/model.js`: include embed in default service list when building view model.
- `operatorMessageServices.js`: **`embed_*`** formatters (version, model missing, listening, restart, unparsed tail).
- `serviceCard.js`: avatar class `sum-av-svc-chimera-embed`, initials **CE**.
- CSS: `card.css` / `design-01.css` tint variables for embed card (pick distinct hue; avoid collision with broker purple / vectorstore green).

**Acceptance**

- Manual smoke: embed subprocess lines appear under **embed** bucket in evlog filters, not **broker**.
- `settings_summarized_dirty_test.go` / routing tests updated.

**Status:** `todo`

---

## Phase 5 — SummarizedFeed service card

**Goal.** Operators get a **chimera-embed** card on `/ui/settings` comparable to vectorstore for answering: *Is llama-server up? Are weights present? Are embeddings succeeding?*

**Deliverables**

- New derive module: `embedui/settings/derive/chimeraEmbedMetrics.js`
  - `embedCardModel(arr, opts)` → subtitle, KV rows, counters (ready, restarts, unparsed, optional `rag.embed` latency).
  - `embedOperatorLine(flat)` for headlines (parallel `qdrantOperatorLine` / broker lines).
- Wire in `summarizedFeed.js`:
  - Add **`chimera-embed`** to default `renderSummarizedUnified` service list (alongside broker, gateway, vectorstore, indexer).
  - **`buildEmbedIntroHtml()`** explainer strip (what embed is, GGUF path, link to config).
  - **`renderExpandedService("chimera-embed")`** branch: KV grid, counters, scoped event log (`suppressEmbedBadge`).
  - Collapsed subtitle from `chimeraEmbedMetrics` (e.g. **Ready · internal/nomic-embed-text** vs **Missing weights**).
- Mount derive from `settings_app.js` / card mount if needed.
- Conditional render: respect `internal_embedding.enabled` from gateway overview cache when available.

**Acceptance**

- With stack running and GGUF present: card shows **up**, endpoint `:8090`, model id.
- With missing GGUF (user's log scenario): card shows **degraded** with clear **Missing GGUF** subtitle, not raw JSON.
- Card coexists with gateway **rag.embed** metrics without duplicate badges in gateway panel.

**Status:** `todo`

---

## Phase 6 — Gateway overview and health

**Goal.** Gateway overview card health strip includes embed when internal embedding is on.

**Deliverables**

- `gatewayOverview.js` `gatewayServiceHealthEntries`: add `{ id: "chimera-embed", raw: … }` from overview payload.
- Extend gateway **`service_overview`** API / cache builder (Go) to include embed state from supervisor control API (`EmbedRequired`, `EmbedReady`, `EmbedEndpoint`, `EmbedRestarts` in `chimera-supervisor/internal/control/state.go`).
- `gatewayCardModel.js`: mention embed in supervised-parts subtitle when enabled.
- Optional: `/status` `SupervisorInfo` embed fields (`embed_supervised`, `embed_http`) for desktop consumers.

**Acceptance**

- Gateway overview compact strip shows **five** segments when embed enabled: gateway, broker, vectorstore, **embed**, indexer.
- Embed segment **down** when supervisor reports not ready (matches user's missing-GGUF case).

**Status:** `todo`

---

## Phase 7 — Tests, gallery, and docs

**Goal.** Prevent regressions; document operator-facing behavior.

**Deliverables**

- Goja tests in `embedui_test/settings_components_test.go`: embed operator lines, card subtitle, routing.
- Gallery entry in `settings/gallery.html` for **chimera-embed** card (collapsed + expanded mock).
- Update [`internal-embedding-provider.md`](internal-embedding-provider.md): point to this plan for UI; mark exploration UI gap closed when shipped.
- Optional row in [`docs/version-v0.3.md`](../version-v0.3.md) at-a-glance table when Phase 5–6 land.

**Acceptance**

- `make chimera-gateway-test-unit` (or targeted embedui tests) pass.
- Gallery page renders embed card without broken CSS.

**Status:** `todo`

---

## Open questions

1. **Card visibility when `internal_embedding.enabled: false`** — hide always, or show if historical embed lines exist in buffer?
2. **`rag.embed` on embed card** — full counter strip vs single “last latency” KV vs gateway-only?
3. **HTTP access logging** — should chimera-embed wrapper proxy/log `POST /v1/embeddings` as `embed.http.access` (like broker), or rely on gateway `rag.embed` only?
4. **Wrapper slug ownership** — map `wrapper.*` → `embed.*` in `embedline` only, or teach `internal/wrapper/runtime` to emit component-prefixed slugs for all components?
5. **Wizard / setup step** — out of scope here, but embed card should reuse copy compatible with future setup wizard step 5 ([`version-v0.3.md`](../version-v0.3.md)).

---

## References

### Code (starting points)

| Area | Path |
|------|------|
| Embed line normalize | `chimera/chimera-embed/internal/embedline/normalize.go` |
| Embed wrapper main | `chimera/chimera-embed/main.go` |
| Wrapper shared runtime | `chimera/internal/wrapper/runtime/runtime.go` |
| Log source constant | `chimera/internal/servicelogs/sources.go` |
| Supervisor embed child | `chimera/chimera-supervisor/internal/supervise/children.go` |
| Supervisor control state | `chimera/chimera-supervisor/internal/control/state.go` |
| Naming / codegen | `internal/naming/gateway_logs.go`, `internal/naming/log_messages.go`, `internal/naming/gencontracts/` |
| Operator registry | `internal/operatorcopy/messages.yaml` |
| UI contracts (generated) | `chimera/chimera-gateway/internal/server/adminui/embed/embedui/settings/contracts.js` |
| Summarized feed | `…/settings/app/summarizedFeed.js` |
| Log routing | `…/settings/app/summarizedDirtyRouting.js` |
| Broker card pattern | `…/settings/derive/chimeraBrokerMetrics.js` |
| Vectorstore card pattern | `…/settings/derive/vectorstoreRagMetrics.js` |
| Gateway overview | `…/settings/render/cards/gatewayOverview.js` |

### Prior art plans

- [`log-qdrant.md`](log-qdrant.md) — taxonomy + qdrantline ingest + service card
- [`log-bifrost.md`](log-bifrost.md) — dual subprocess + gateway relay slugs
- [`embedui-component-system.md`](embedui-component-system.md) — card extraction conventions

### Config / operator setup

- Example config: `config/internal-embedding.example.yaml`, `config/gateway.example.yaml` (`internal_embedding`, `rag.embedding`)
- Weights: operator places **`nomic-embed-text.gguf`** at `data/embedding/models/` (`make chimera-embed-configure`)
- Install: `make chimera-embed-install`, `make chimera-embed-build`

### Make targets for implementers

```bash
make operator-contracts-generate   # after messages.yaml + naming changes
make operator-contracts-check
make chimera-embed-test-unit
make chimera-gateway-test-unit       # embedui Goja tests
```
