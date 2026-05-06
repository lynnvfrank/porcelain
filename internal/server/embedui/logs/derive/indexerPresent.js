/**
 * Indexer log presentation helpers (pure). Used by logs.js and tested via goja.
 *
 * ClaudiaLogs.Derive.indexerDeclaredStateLabel(code)
 * ClaudiaLogs.Derive.indexerSlugHistogramBucket(msgLower)
 * ClaudiaLogs.Derive.indexerGroupKeyFromFlat(flat)
 * ClaudiaLogs.Derive.indexerFlatMsg(flat) — normalizes msg/message
 * ClaudiaLogs.Derive.indexerProseSummary(flat) — one-line operator prose; null → caller fallback
 */

function indexerDeclaredStateLabel(code) {
  switch (String(code || "").trim()) {
    case "watch_idle":
      return "Waiting for file changes";
    case "backlog":
      return "Queued files to process";
    case "uploading":
      return "Uploading to gateway";
    case "recovery":
      return "Recovering (waiting for gateway / storage)";
    case "initial_scanning":
      return "Scanning workspace";
    case "idle":
      return "Idle";
    default:
      return code ? String(code) : "";
  }
}

function indexerFlatMsg(fl) {
  if (!fl || typeof fl !== "object") fl = {};
  var msg = fl.msg != null ? fl.msg : fl.message;
  var raw = String(msg != null ? msg : "").toLowerCase().trim();
  // slog JSON often contains duplicate `"msg"` keys (human title + slug). JSON.parse tends to
  // keep one implementation-defined winner — infer slug from sibling attrs when ambiguous.
  if (raw === "indexer.state") return "indexer.state";
  if (raw === "indexer state") {
    if (
      fl.state != null &&
      String(fl.state).trim() !== "" &&
      (fl.queue_depth != null || fl.ingest_inflight != null || typeof fl.watch_mode === "boolean")
    )
      return "indexer.state";
  }
  if (raw === "indexer.storage.stats" || raw.indexOf("indexer.storage.stats") === 0) return "indexer.storage.stats";
  if (raw === "indexer storage stats sync" || raw === "indexer storage stats") {
    if (fl.qdrant_points != null || fl.collection != null || fl.available != null || fl.detail != null) {
      return "indexer.storage.stats";
    }
  }
  if (raw === "indexer.queue.snapshot" || raw.indexOf("indexer.queue.snapshot") === 0) return "indexer.queue.snapshot";
  if (raw === "indexer queue snapshot" && fl.queue_depth != null && fl.phase != null) return "indexer.queue.snapshot";
  if (raw === "indexer.discovery.summary.scope" || raw.indexOf("indexer.discovery.summary.scope") === 0)
    return "indexer.discovery.summary.scope";
  if (raw === "discovery summary (scope)" && fl.ingest_project != null) return "indexer.discovery.summary.scope";
  if (raw === "indexer.discovery.summary" || raw.indexOf("indexer.discovery.summary") === 0) return "indexer.discovery.summary";
  if (raw === "discovery summary" && fl.candidates_enqueued != null) return "indexer.discovery.summary";
  if (raw === "indexer.scan.complete" || raw.indexOf("indexer.scan.complete") === 0) return "indexer.scan.complete";
  if (raw === "scan fan-out budget" && fl.n_scopes != null) return "indexer.scan.complete";
  if (raw === "gateway.indexer.config" || raw.indexOf("gateway.indexer.config") === 0) return "gateway.indexer.config";
  if (raw === "gateway indexer config" && (fl.gateway_version != null || fl.embedding_model != null)) return "gateway.indexer.config";
  if (raw === "indexer.run.start" || raw.indexOf("indexer.run.start") === 0) return "indexer.run.start";
  if (
    raw === "indexer run start" &&
    (fl.watch_root_paths != null || fl.root_ids != null || fl.root_scopes != null || fl.roots != null)
  )
    return "indexer.run.start";
  if (raw === "indexer.job.ingested") return "indexer.job.ingested";
  if (raw === "ingested" && fl.chunks != null) return "indexer.job.ingested";
  if (raw === "indexer.job.upload") return "indexer.job.upload";
  if (raw === "job upload" && fl.rel != null) return "indexer.job.upload";
  if (raw === "indexer.job.skipped") return "indexer.job.skipped";
  if (raw === "job skipped" && (fl.rel != null || fl.skip_reason != null)) return "indexer.job.skipped";
  return raw;
}

function indexerSlugHistogramBucket(msgLower) {
  var m = String(msgLower || "").trim();
  if (!m) return "other";
  if (m.indexOf("indexer.run.") === 0) return "lifecycle";
  if (m.indexOf("indexer.discovery") === 0 || m.indexOf("indexer.reconcile") === 0) return "discovery";
  if (m.indexOf("indexer.job.") === 0) return "jobs";
  if (m.indexOf("indexer.queue") === 0) return "queue";
  if (m === "indexer.state" || m.indexOf("indexer.storage.stats") === 0) return "statestats";
  if (m.indexOf("gateway.indexer.config") === 0) return "config";
  if (
    m.indexOf("indexer.recovery") === 0 ||
    m.indexOf("indexer.retry") === 0 ||
    m.indexOf("indexer.worker.paused") === 0
  ) {
    return "recovery";
  }
  if (m.indexOf("indexer.") === 0) return "indexer_misc";
  return "other";
}

function indexerGroupKeyFromFlat(fl) {
  if (!fl || typeof fl !== "object") return "";
  var ik =
    fl.indexer_key != null && String(fl.indexer_key).trim() !== ""
      ? String(fl.indexer_key).trim()
      : "";
  if (ik) return ik;
  // Match backend IndexerKey inputs: tenant + effective project + flavor (no workspace).
  var uid = String(fl.principal_id || fl.tenant_id || fl.tenant || "").trim();
  var proj = String(
    fl.ingest_project ||
      fl.defaults_project_id ||
      fl.scope_project_id ||
      fl.scope_workspace_id ||
      ""
  ).trim();
  var fav = String(fl.flavor_id || fl.defaults_flavor_id || "").trim();
  if (uid !== "" && proj !== "" && fav !== "") {
    return "ig\x1e" + uid + "\x1e" + proj + "\x1e" + fav;
  }
  var rid =
    fl.index_run_id != null && String(fl.index_run_id).trim() !== ""
      ? String(fl.index_run_id).trim()
      : "";
  return rid || "";
}

function numOrDash(v) {
  var n = Number(v);
  return isNaN(n) ? null : n;
}

/** Operator-facing one-line description for indexer structured logs. */
function indexerProseSummary(flat) {
  if (!flat || typeof flat !== "object") return null;
  var m = indexerFlatMsg(flat);
  var svc = String(flat.service || "").toLowerCase();
  var indexerish = svc === "indexer" || m.indexOf("indexer.") === 0 || m.indexOf("gateway.indexer") === 0;
  if (!indexerish) return null;

  switch (m) {
    case "indexer.state": {
      var st = indexerDeclaredStateLabel(flat.state);
      var bits = [];
      if (st) bits.push(st);
      var qd = numOrDash(flat.queue_depth);
      if (qd != null) bits.push("queue depth " + qd);
      var infl = numOrDash(flat.ingest_inflight);
      if (infl != null && infl > 0) bits.push("uploads in flight " + infl);
      var qp = numOrDash(flat.qdrant_points_reported);
      if (qp != null) bits.push("Qdrant vectors " + qp);
      return bits.length ? bits.join(" · ") : "Indexer status update";
    }
    case "indexer.storage.stats": {
      var pts = numOrDash(flat.qdrant_points);
      var avail = flat.available === true || flat.available === "true";
      if (pts != null)
        return (
          "Qdrant corpus: " +
          pts +
          " vectors" +
          (flat.collection ? " (" + String(flat.collection).slice(0, 56) + (String(flat.collection).length > 56 ? "…" : "") + ")" : "")
        );
      if (!avail && flat.detail) return "Storage stats unavailable: " + String(flat.detail).slice(0, 120);
      return "Storage stats sync";
    }
    case "gateway.indexer.config":
      return (
        "Gateway indexer settings loaded (chunk " +
        (flat.chunk_size != null ? flat.chunk_size : "?") +
        ", model " +
        (flat.embedding_model ? String(flat.embedding_model).split("/").pop() : "?") +
        ")"
      );
    case "indexer.run.start": {
      var nroots = flat.roots != null ? flat.roots : "?";
      return "Indexer started · " + nroots + " watch root(s) · roots " + (flat.root_ids || "—");
    }
    case "indexer.discovery.summary":
      return (
        "Discovery: " +
        (flat.candidates_discovered != null ? flat.candidates_discovered : "?") +
        " candidates, " +
        (flat.files_excluded_by_ignore_rules != null ? flat.files_excluded_by_ignore_rules : flat.skipped_ignored || "?") +
        " paths excluded by ignore rules"
      );
    case "indexer.discovery.summary.scope":
      return (
        "Discovery · " +
        (flat.ingest_project != null ? String(flat.ingest_project) : "?") +
        " / " +
        (flat.flavor_id != null ? String(flat.flavor_id) : "?") +
        " · " +
        (flat.candidates_discovered != null ? flat.candidates_discovered : "?") +
        " files · " +
        (flat.path_sample_count != null ? flat.path_sample_count : "?") +
        " path(s) logged" +
        (flat.paths_truncated ? " (truncated)" : "")
      );
    case "indexer.scan.complete":
      return (
        "Scan done · " +
        (flat.n_scopes != null ? flat.n_scopes : "?") +
        " scope(s) · budget " +
        (flat.per_scope_fanout_budget != null ? flat.per_scope_fanout_budget : "?") +
        " pending bulk per scope · cap " +
        (flat.queue_cap != null ? flat.queue_cap : "?")
      );
    case "indexer.reconcile.summary":
      return (
        "Corpus inventory loaded · " +
        (flat.remote_source_paths != null ? flat.remote_source_paths : "?") +
        " remote source path(s)"
      );
    case "indexer.queue.snapshot":
      return (
        "Queue snapshot · depth " +
        (flat.queue_depth != null ? flat.queue_depth : "?") +
        " · completed " +
        (flat.ingest_completed != null ? flat.ingest_completed : "?") +
        (flat.phase ? " · " + String(flat.phase) : "")
      );
    case "indexer.run.progress":
      return (
        "Progress · " +
        (flat.phase ? String(flat.phase) : "phase") +
        (flat.candidates_enqueued != null ? " · " + flat.candidates_enqueued + " enqueued" : "")
      );
    case "indexer.job.upload": {
      var tr = flat.transport ? String(flat.transport) : "whole";
      var sz = flat.bytes != null ? formatBytesShort(flat.bytes) : "?";
      return "Upload starting · " + (flat.rel || "file") + " · " + sz + " · " + tr;
    }
    case "indexer.job.ingested":
    case "ingested":
      return "Ingested · " + (flat.rel || "file") + " · " + (flat.chunks != null ? flat.chunks + " chunk(s)" : "done");
    case "indexer.job.skipped":
      return (
        "Skipped · " +
        (flat.rel || "file") +
        (flat.skip_reason ? " · " + String(flat.skip_reason).replace(/_/g, " ") : "")
      );
    case "indexer.retry.scheduled":
      return (
        "Retry scheduled · " +
        (flat.rel || "file") +
        " · attempt " +
        (flat.attempt != null ? flat.attempt : "?") +
        " · backoff " +
        (flat.delay_ms != null ? flat.delay_ms + " ms" : "?")
      );
    case "indexer.recovery.poll":
      return (
        "Recovery poll #" +
        (flat.poll_n != null ? flat.poll_n : "?") +
        " · storage " +
        (flat.storage_ok === true ? "OK" : flat.storage_ok === false ? "not OK" : "?")
      );
    case "indexer.recovery.resumed":
      return "Storage recovered — resuming workers";
    case "indexer.worker.paused":
      return "Worker paused for recovery · " + (flat.rel || "pending job");
    case "indexer.run.done":
    case "indexer run done":
    case "indexer run stopped":
      return (
        "Run finished · mode " +
        (flat.mode || "?") +
        " · ingested " +
        (flat.ingest_completed != null ? flat.ingest_completed : "?") +
        " · failures " +
        (flat.ingest_failed_dropped != null ? flat.ingest_failed_dropped : "?")
      );
    default:
      if (m.indexOf("indexer.job.failed") === 0 || m.indexOf("ingest failed (dropped)") === 0) {
        return (
          "Ingest failed (dropped) · " +
          (flat.rel || "?") +
          (flat.err ? " · " + String(flat.err).slice(0, 120) : "")
        );
      }
      return null;
  }
}

function formatBytesShort(n) {
  var x = Number(n);
  if (isNaN(x)) return "?";
  if (x < 1024) return x + " B";
  if (x < 1024 * 1024) return (x / 1024).toFixed(1) + " KB";
  return (x / (1024 * 1024)).toFixed(1) + " MB";
}

globalThis.ClaudiaLogs = globalThis.ClaudiaLogs || {};
globalThis.ClaudiaLogs.Derive = globalThis.ClaudiaLogs.Derive || {};
globalThis.ClaudiaLogs.Derive.indexerDeclaredStateLabel = indexerDeclaredStateLabel;
globalThis.ClaudiaLogs.Derive.indexerSlugHistogramBucket = indexerSlugHistogramBucket;
globalThis.ClaudiaLogs.Derive.indexerGroupKeyFromFlat = indexerGroupKeyFromFlat;
globalThis.ClaudiaLogs.Derive.indexerFlatMsgForPresent = indexerFlatMsg;
globalThis.ClaudiaLogs.Derive.indexerProseSummary = indexerProseSummary;
