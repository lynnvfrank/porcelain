/**
 * Indexer operator formatters (Phase 4). Merges into ChimeraLogs.Render operator formatters.
 */
(function () {
  globalThis.ChimeraLogs = globalThis.ChimeraLogs || {};
  globalThis.ChimeraLogs.Render = globalThis.ChimeraLogs.Render || {};
  var base = globalThis.ChimeraLogs.Render._operatorFormatters || {};

  function numOrDash(v) {
    var n = Number(v);
    return isNaN(n) ? null : n;
  }

  function formatIntCount(v) {
    var n = numOrDash(v);
    return n != null ? String(Math.round(n)) : "?";
  }

  function formatBytesShort(n) {
    var x = Number(n);
    if (isNaN(x)) return "?";
    if (x < 1024) return x + " B";
    if (x < 1024 * 1024) return (x / 1024).toFixed(1) + " KB";
    return (x / (1024 * 1024)).toFixed(1) + " MB";
  }

  function indexerStateLabel(code) {
    var oc = globalThis.ChimeraLogs && ChimeraLogs.OperatorCopy;
    var labels = oc && oc.indexerStateLabels;
    var key = String(code || "").trim();
    if (labels && key && labels[key]) return labels[key];
    return key ? key : "";
  }

  function workKindShortLabel(flat) {
    var k = flat.kind;
    if (k === 1 || k === "1") return "scan";
    if (k === 2 || k === "2") return "fanout list";
    if (k === 0 || k === "0") return "ingest";
    var s = k != null ? String(k).trim() : "";
    if (!s) return "?";
    if (s === "WorkScan" || s.toLowerCase() === "workscan") return "scan";
    if (s === "WorkFanoutList") return "fanout list";
    if (s === "WorkIngest") return "ingest";
    return s;
  }

  /** Short explanation for ingest failure `err` strings (HTTP paths + JSON are noisy in summaries). */
  function shortIngestFailureDetail(flat) {
    var e = flat.err != null ? String(flat.err) : "";
    if (!e) return "";
    var el = e.toLowerCase().replace(/\s+/g, " ");
    if (el.indexOf("unknown or expired session") >= 0)
      return "chunked upload session missing or expired on gateway (restart, long stall, or different host)";
    if (
      el.indexOf("/v1/ingest/session/") >= 0 &&
      el.indexOf("/complete") >= 0 &&
      (el.indexOf("404") >= 0 || el.indexOf("status 404") >= 0)
    )
      return "ingest /complete returned 404 — session gone before upload finished";
    return e.replace(/\s+/g, " ").slice(0, 140);
  }

  var ix = {
    indexer_rag_source: function (flat) {
      var nRag = numOrDash(flat.source_hits);
      return (
        "RAG retrieved · " +
        (nRag != null ? nRag + " hit(s) · " : "") +
        String(flat.rel != null ? flat.rel : "?")
      );
    },
    indexer_supervised_wait_roots: function (flat, entry) {
      var base = entry.summary || "Waiting for at least one watch root";
      if (flat.config_path != null && String(flat.config_path).trim() !== "")
        return base + " in " + String(flat.config_path).trim();
      return base;
    },
    indexer_state: function (flat) {
      var st = indexerStateLabel(flat.state);
      var bits = [];
      if (st) bits.push(st);
      var qd = numOrDash(flat.queue_depth);
      if (qd != null) bits.push("queue depth " + qd);
      var infl = numOrDash(flat.ingest_inflight);
      if (infl != null && infl > 0) bits.push("uploads in flight " + infl);
      return bits.length ? bits.join(" · ") : "Indexer status update";
    },
    indexer_storage_stats: function (flat) {
      var pts = numOrDash(flat.qdrant_points);
      var avail = flat.available === true || flat.available === "true";
      if (pts != null) return "Indexed vectors: " + pts;
      if (!avail && flat.detail) return "Storage stats unavailable: " + String(flat.detail).slice(0, 120);
      return "Storage stats sync";
    },
    indexer_gateway_config: function (flat) {
      return (
        "Gateway indexer settings loaded (chunk " +
        (flat.chunk_size != null ? flat.chunk_size : "?") +
        ", model " +
        (flat.embedding_model ? String(flat.embedding_model).split("/").pop() : "?") +
        ")"
      );
    },
    indexer_run_start: function (flat) {
      var nroots = flat.roots != null ? flat.roots : "?";
      return "Indexer started · " + nroots + " watch root(s) · roots " + (flat.root_ids || "—");
    },
    indexer_discovery: function (flat, entry) {
      var slug = entry && entry.slug ? entry.slug : "";
      if (slug === "indexer.discovery.summary.scope") {
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
      }
      if (slug === "indexer.scan.complete") {
        return (
          "Scan done · " +
          (flat.n_scopes != null ? flat.n_scopes : "?") +
          " scope(s) · budget " +
          (flat.per_scope_fanout_budget != null ? flat.per_scope_fanout_budget : "?") +
          " pending bulk per scope · cap " +
          (flat.queue_cap != null ? flat.queue_cap : "?")
        );
      }
      return (
        "Discovery: " +
        (flat.candidates_discovered != null ? flat.candidates_discovered : "?") +
        " candidates, " +
        (flat.files_excluded_by_ignore_rules != null ? flat.files_excluded_by_ignore_rules : flat.skipped_ignored || "?") +
        " paths excluded by ignore rules"
      );
    },
    indexer_scope_status: function (flat) {
      var wst = formatIntCount(flat.workspace_files_total);
      var qIn = formatIntCount(flat.queue_ingest_pending);
      var qFan = formatIntCount(flat.queue_fanout_files_pending);
      return (
        "~" +
        wst +
        " files in workspace · " +
        qIn +
        " waiting to embed · " +
        qFan +
        " waiting in discovery queue"
      );
    },
    indexer_scope_active_file: function (flat) {
      return (
        "Indexing · project " +
        (flat.project_id != null ? String(flat.project_id) : flat.ingest_project != null ? String(flat.ingest_project) : "?") +
        " · relative path " +
        (flat.rel || "?")
      );
    },
    indexer_reconcile_summary: function (flat, entry) {
      var base = entry.summary || "Corpus inventory loaded";
      return (
        base +
        " · " +
        (flat.remote_source_paths != null ? flat.remote_source_paths : "?") +
        " remote source path(s)"
      );
    },
    indexer_queue_snapshot: function (flat) {
      var dep = numOrDash(flat.queue_depth);
      var comp = numOrDash(flat.ingest_completed);
      var dStr = dep != null ? String(dep) : "?";
      var cStr = comp != null ? String(comp) : "?";
      var idleLead = dep === 0 ? "idle · " : "";
      return "Queue · " + idleLead + dStr + " waiting · " + cStr + " completed this run";
    },
    indexer_run_progress: function (flat) {
      return (
        "Progress · " +
        (flat.phase ? String(flat.phase) : "phase") +
        (flat.candidates_enqueued != null ? " · " + flat.candidates_enqueued + " enqueued" : "")
      );
    },
    indexer_job_upload: function (flat) {
      var tr = flat.transport ? String(flat.transport) : "whole";
      var sz = flat.bytes != null ? formatBytesShort(flat.bytes) : "?";
      return "Uploading · " + (flat.rel || "file") + " · " + sz + " · " + tr;
    },
    indexer_job_ingested: function (flat) {
      return "Ingested · " + (flat.rel || "file") + " · " + (flat.chunks != null ? flat.chunks + " chunk(s)" : "done");
    },
    indexer_job_skipped: function (flat) {
      return (
        "Skipped · " +
        (flat.rel || "file") +
        (flat.skip_reason ? " · " + String(flat.skip_reason).replace(/_/g, " ") : "")
      );
    },
    indexer_retry_recovery: function (flat, entry) {
      var slug = entry && entry.slug ? entry.slug : "";
      if (slug === "indexer.retry.scheduled") {
        return (
          "Retry scheduled · " +
          (flat.rel || "file") +
          " · attempt " +
          (flat.attempt != null ? flat.attempt : "?") +
          " · backoff " +
          (flat.delay_ms != null ? flat.delay_ms + " ms" : "?")
        );
      }
      if (slug === "indexer.recovery.poll") {
        return (
          "Recovery poll #" +
          (flat.poll_n != null ? flat.poll_n : "?") +
          " · storage " +
          (flat.storage_ok === true ? "OK" : flat.storage_ok === false ? "not OK" : "?")
        );
      }
      if (slug === "indexer.worker.paused") {
        return "Worker paused for recovery · " + (flat.rel || "pending job");
      }
      return entry.summary || "";
    },
    indexer_run_done: function (flat) {
      return (
        "Run finished · mode " +
        (flat.mode || "?") +
        " · ingested " +
        (flat.ingest_completed != null ? flat.ingest_completed : "?") +
        " · failures " +
        (flat.ingest_failed_dropped != null ? flat.ingest_failed_dropped : "?")
      );
    },
    indexer_fanout: function (flat, entry) {
      if (entry && entry.slug === "indexer.fanout.enqueue_failed") {
        var nc = formatIntCount(flat.candidates);
        return "Couldn't queue discovery batch (queue full?) · " + nc + " paths";
      }
      return entry.summary || "Could not re-queue remaining discovery work";
    },
    indexer_work_failed: function (flat) {
      return "Background job failed · " + workKindShortLabel(flat) + " · dropped";
    },
    indexer_sync_state_failed: function (flat, entry) {
      var base = entry.summary || "Couldn't save sync checkpoint after ingest";
      return base + " · " + (flat.rel != null ? String(flat.rel) : "?");
    },
    indexer_job_failed: function (flat) {
      var tail = shortIngestFailureDetail(flat);
      return "Ingest failed (dropped) · " + (flat.rel || "?") + (tail ? " · " + tail : "");
    }
  };

  Object.assign(base, ix);
  globalThis.ChimeraLogs.Render._operatorFormatters = base;
  globalThis.ChimeraLogs.Render.shortIngestFailureDetail = shortIngestFailureDetail;
  globalThis.ChimeraLogs.Derive = globalThis.ChimeraLogs.Derive || {};
  globalThis.ChimeraLogs.Derive.shortIngestFailureDetail = shortIngestFailureDetail;
})();
