/**
 * Transport + cache: initial load, SSE streaming, poll fallback, backfill older entries.
 *
 * Exports:
 * - ClaudiaLogs.Transport.init(ctx)
 *
 * ctx requirements (functions/refs):
 * - getViewMode(), setViewMode(next)
 * - getEmbedded(): boolean
 * - getStarted(), setStarted(bool)
 * - statusEl (nullable)
 * - nearBottom(), nearBottomTextarea(ta)
 * - parseLogText(source,text,ts)
 * - entryCache (array), seenSeq (object), maxSeqRef {value}, minLoadedSeqRef {value}
 * - bufferMinSeqRef {value}, bufferMinSeqFromServerRef {value}
 * - constants: CLIENT_CACHE_MAX, INITIAL_TAIL_LIMIT, BACKFILL_CHUNK, RENDER_CHUNK, stickPx
 * - render hooks: scheduleStoryRebuild(), rebuildAllRows(), rebuildRawLogsTextarea(opts),
 *   appendRawLineToTextarea(ent, follow) (legacy), appendTableRow(parsed, follow, seq, entryTs, rawText)
 *   Raw live stream uses scheduleRawLogsDomFlush (rAF-coalesced rebuild; avoids textarea +=).
 * - filters hooks: applyFilters(), ensureAppOption(app), ensureLevelOption(lvl), entryMatchesFilters(parsed)
 * - fetchTokenLabels()
 */

function syncPollMeta(ctx, data) {
  if (!data) return;
  if (data.buffer_min_seq != null) ctx.bufferMinSeqFromServerRef.value = data.buffer_min_seq;
  // NOTE: Do NOT mirror data.max_seq into ctx.maxSeqRef here.
  // Poll responses can include a *server-wide* max_seq even when `lines` is only a subset
  // (e.g. initial tail load). If we bump maxSeqRef before processing `lines`, appendLine()
  // treats every returned line as already ingested (seq <= maxSeqRef) and drops them,
  // leaving entryCache empty while the textarea shows stale content.
}

function statusGet(ctx) {
  if (ctx.statusLine && ctx.statusLine.get) return ctx.statusLine.get();
  return ctx.statusEl ? String(ctx.statusEl.textContent || "") : "";
}

function statusSet(ctx, text, cls) {
  if (ctx.statusLine && ctx.statusLine.set) {
    ctx.statusLine.set(text, cls);
    return;
  }
  if (!ctx.statusEl) return;
  ctx.statusEl.textContent = text == null ? "" : String(text);
  if (cls != null) ctx.statusEl.className = String(cls);
}

function prependHistoricalEntries(ctx, entriesOldestFirst) {
  if (!entriesOldestFirst || !entriesOldestFirst.length) return;
  var roll = [];
  for (var i = 0; i < entriesOldestFirst.length; i++) {
    var e = entriesOldestFirst[i];
    if (!e || !e.seq || ctx.seenSeq[e.seq]) continue;
    ctx.seenSeq[e.seq] = true;
    roll.push({
      seq: e.seq,
      source: e.source,
      text: e.text || "",
      ts: e.ts,
      parsed: ctx.parseLogText(e.source, e.text || "", e.ts)
    });
  }
  if (!roll.length) return;

  var prevH = document.documentElement.scrollHeight;
  var prevTop = window.scrollY;
  ctx.entryCache.splice(0, 0, ...roll);
  while (ctx.entryCache.length > ctx.CLIENT_CACHE_MAX) {
    var gone = ctx.entryCache.shift();
    if (gone && gone.seq) delete ctx.seenSeq[gone.seq];
  }
  ctx.minLoadedSeqRef.value = ctx.entryCache.length ? ctx.entryCache[0].seq : ctx.minLoadedSeqRef.value;

  var viewMode = ctx.getViewMode();
  if (viewMode === "summarized") {
    ctx.scheduleStoryRebuild();
  } else if (viewMode === "raw") {
    ctx.rebuildAllRows();
    window.requestAnimationFrame(function () {
      var dh = document.documentElement.scrollHeight - prevH;
      window.scrollTo(0, prevTop + dh);
    });
  } else if (viewMode === "raw_logs") {
    var ta = document.getElementById("raw-logs-textarea");
    var prevTaTop = ta ? ta.scrollTop : 0;
    var prevTaScrollH = ta ? ta.scrollHeight : 0;
    ctx.rebuildRawLogsTextarea({ scrollBottom: false });
    if (ta) {
      window.requestAnimationFrame(function () {
        ta.scrollTop = prevTaTop + (ta.scrollHeight - prevTaScrollH);
      });
    }
  }
  ctx.applyFilters();
}

function fetchOlderLogs(ctx) {
  if (ctx.olderFetchBusyRef.value) return;
  if (!ctx.minLoadedSeqRef.value || !ctx.bufferMinSeqFromServerRef.value) return;
  if (ctx.minLoadedSeqRef.value <= ctx.bufferMinSeqFromServerRef.value) return;

  ctx.olderFetchBusyRef.value = true;
  var prevStatus = statusGet(ctx);
  statusSet(ctx, "Loading older…");

  fetch(
    "/api/ui/logs?before_seq=" + encodeURIComponent(String(ctx.minLoadedSeqRef.value)) + "&limit=" + ctx.BACKFILL_CHUNK,
    { credentials: "same-origin" }
  )
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      syncPollMeta(ctx, data);
      prependHistoricalEntries(ctx, data.lines || []);
      ctx.olderFetchBusyRef.value = false;
      statusSet(ctx, prevStatus.indexOf("Live") >= 0 ? prevStatus : "Live (SSE)");
    })
    .catch(function () {
      ctx.olderFetchBusyRef.value = false;
      statusSet(ctx, prevStatus);
    });
}

/**
 * Batch raw_logs textarea updates to one rebuild per animation frame. Incremental
 * `textarea.value += line` is O(n²) in characters and freezes the UI on large buffers.
 */
function scheduleRawLogsDomFlush(ctx, followTa) {
  ctx.rawLogsFlushFollow = ctx.rawLogsFlushFollow || followTa;
  if (ctx.rawLogsRafPending) return;
  ctx.rawLogsRafPending = true;
  window.requestAnimationFrame(function () {
    ctx.rawLogsRafPending = false;
    var ta0 = document.getElementById("raw-logs-textarea");
    var scroll =
      typeof ctx.nearBottomTextarea === "function" && ta0
        ? ctx.nearBottomTextarea(ta0) && ctx.rawLogsFlushFollow
        : ctx.rawLogsFlushFollow;
    ctx.rebuildRawLogsTextarea({ scrollBottom: !!scroll });
    ctx.rawLogsFlushFollow = false;
  });
}

function appendLine(ctx, e) {
  if (!e || e.seq == null) return;
  var sq = Number(e.seq);
  if (!sq || ctx.seenSeq[sq]) return;
  ctx.seenSeq[sq] = true;
  ctx.maxSeqRef.value = Math.max(ctx.maxSeqRef.value, sq);

  var follow = ctx.nearBottom();
  var parsed = ctx.parseLogText(e.source, e.text || "", e.ts);
  ctx.entryCache.push({ seq: e.seq, source: e.source, text: e.text || "", ts: e.ts, parsed: parsed });

  var cacheTrimmed = false;
  while (ctx.entryCache.length > ctx.CLIENT_CACHE_MAX) {
    var gone = ctx.entryCache.shift();
    if (gone && gone.seq) delete ctx.seenSeq[gone.seq];
    cacheTrimmed = true;
  }

  var viewMode = ctx.getViewMode();
  if (viewMode === "summarized") {
    ctx.scheduleStoryRebuild();
    if (follow) window.scrollTo(0, document.documentElement.scrollHeight);
    return;
  }
  if (viewMode === "raw_logs") {
    ctx.ensureAppOption(parsed.app);
    if (parsed.levelCanon) ctx.ensureLevelOption(parsed.levelCanon);
    var ta0 = document.getElementById("raw-logs-textarea");
    if (cacheTrimmed) {
      ctx.rebuildRawLogsTextarea({ scrollBottom: ctx.nearBottomTextarea(ta0) });
      return;
    }
    if (ctx.suppressRawLogsDom) return;
    var followTa = ctx.nearBottomTextarea(ta0);
    if (ctx.entryMatchesFilters(parsed)) {
      scheduleRawLogsDomFlush(ctx, followTa);
    }
    return;
  }
  ctx.ensureAppOption(parsed.app);
  if (parsed.levelCanon) ctx.ensureLevelOption(parsed.levelCanon);
  ctx.appendTableRow(parsed, follow, e.seq, e.ts, e.text);
}

function applyPollPayloadBatched(ctx, data, opts, startIdx, doneFn) {
  opts = opts || {};
  syncPollMeta(ctx, data);
  var lines = data.lines || [];
  var i = startIdx || 0;
  var end = Math.min(i + ctx.RENDER_CHUNK, lines.length);
  var bulkRaw = ctx.getViewMode() === "raw_logs";
  if (bulkRaw) ctx.suppressRawLogsDom = true;
  for (; i < end; i++) {
    appendLine(ctx, lines[i]);
  }
  if (bulkRaw) {
    ctx.suppressRawLogsDom = false;
    var taBulk = document.getElementById("raw-logs-textarea");
    ctx.rebuildRawLogsTextarea({ scrollBottom: ctx.nearBottomTextarea(taBulk) });
  }

  if (end < lines.length) {
    statusSet(ctx, "Rendering… " + end + "/" + lines.length);
    window.requestAnimationFrame(function () {
      applyPollPayloadBatched(ctx, data, opts, end, doneFn);
    });
    return;
  }
  if (lines.length) ctx.minLoadedSeqRef.value = lines[0].seq;
  if (opts.rawPrimeScroll && lines.length && (ctx.getViewMode() === "raw" || ctx.getViewMode() === "raw_logs")) {
    window.requestAnimationFrame(function () {
      if (ctx.getViewMode() === "raw") window.scrollTo(0, document.documentElement.scrollHeight);
      else {
        var ta = document.getElementById("raw-logs-textarea");
        if (ta) ta.scrollTop = ta.scrollHeight;
      }
    });
  }
  if (doneFn) doneFn();
}

function pollOnce(ctx) {
  // Always poll in small batches to keep the UI responsive even if we fell behind.
  fetch("/api/ui/logs?since=" + ctx.maxSeqRef.value + "&limit=220", { credentials: "same-origin" })
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      syncPollMeta(ctx, data);
      var lines = data.lines || [];
      applyPollPayloadBatched(ctx, data, {}, 0, function () {
        // Self-heal: if we're in poll fallback and the UI is still empty, prime once from the tail.
        if ((!ctx.entryCache || ctx.entryCache.length === 0) && lines.length === 0 && !ctx._tailPrimed) {
          ctx._tailPrimed = true;
          fetch("/api/ui/logs?since=0&limit=" + ctx.INITIAL_TAIL_LIMIT, { credentials: "same-origin" })
            .then(function (r2) {
              if (!r2.ok) throw new Error("HTTP " + r2.status);
              return r2.json();
            })
            .then(function (data2) {
              applyPollPayloadBatched(ctx, data2, { rawPrimeScroll: true }, 0, function () {
                ctx.fetchTokenLabels();
              });
            })
            .catch(function () {});
        }
        statusSet(ctx, "Live (poll)", "");
      });
    })
    .catch(function () {
      statusSet(ctx, "Log API error — check session", "err");
    });
}

function startPolling(ctx) {
  if (ctx.pollTimerRef.value) return;
  if (ctx.esRef.value) {
    try { ctx.esRef.value.close(); } catch (x) {}
    ctx.esRef.value = null;
  }
  pollOnce(ctx);
  ctx.pollTimerRef.value = setInterval(function () { pollOnce(ctx); }, 1500);
}

function stopPolling(ctx) {
  if (ctx.pollTimerRef.value) {
    try { clearInterval(ctx.pollTimerRef.value); } catch (x) {}
    ctx.pollTimerRef.value = null;
  }
}

function startEventSource(ctx) {
  stopPolling(ctx);
  if (ctx.esRef.value) return;
  var url = "/api/ui/logs/stream";
  try {
    ctx.esRef.value = new EventSource(url, { withCredentials: true });
  } catch (x) {
    ctx.esRef.value = new EventSource(url);
  }
  var es = ctx.esRef.value;

  var sseFailed = window.setTimeout(function () {
    if (es && es.readyState === EventSource.OPEN) return;
    startPolling(ctx);
  }, 12000);

  es.onopen = function () {
    window.clearTimeout(sseFailed);
    stopPolling(ctx);
    statusSet(ctx, "Live (SSE)", "");
  };
  es.onerror = function () {
    window.clearTimeout(sseFailed);
    if (es && es.readyState === EventSource.CLOSED) {
      startPolling(ctx);
    } else {
      statusSet(ctx, "SSE reconnecting…", "err");
      window.setTimeout(function () {
        if (es && es.readyState !== EventSource.OPEN) startPolling(ctx);
      }, 2000);
    }
  };
  es.onmessage = function (ev) {
    try {
      appendLine(ctx, JSON.parse(ev.data));
    } catch (x) {
      statusSet(ctx, "Bad frame", "err");
    }
  };
}

function startStreaming(ctx) {
  if (ctx.getStarted()) return;
  if (ctx.startingRef && ctx.startingRef.value) return;
  if (ctx.startingRef) ctx.startingRef.value = true;
  statusSet(ctx, "Loading history…");
  var ac = null;
  var timeoutId = null;
  if (typeof AbortController !== "undefined") {
    ac = new AbortController();
    timeoutId = window.setTimeout(function () {
      try { ac.abort(); } catch (x) {}
    }, 10000);
  }
  var fetchOpts = { credentials: "same-origin" };
  if (ac) fetchOpts.signal = ac.signal;
  fetch("/api/ui/logs?since=0&limit=" + ctx.INITIAL_TAIL_LIMIT, fetchOpts)
    .then(function (r) {
      if (timeoutId != null) {
        try { window.clearTimeout(timeoutId); } catch (x) {}
      }
      if (!r.ok) {
        var httpErr = new Error("HTTP " + r.status);
        httpErr.status = r.status;
        throw httpErr;
      }
      return r.json();
    })
    .then(function (data) {
      if (timeoutId != null) {
        try { window.clearTimeout(timeoutId); } catch (x) {}
      }
      if (ctx.startingRef) ctx.startingRef.value = false;
      // Only mark as started after we successfully loaded the small history tail.
      ctx.setStarted(true);
      applyPollPayloadBatched(ctx, data, { rawPrimeScroll: true }, 0, function () {
        ctx.fetchTokenLabels();
        startEventSource(ctx);
      });
    })
    .catch(function (err) {
      if (timeoutId != null) {
        try { window.clearTimeout(timeoutId); } catch (x) {}
      }
      if (ctx.startingRef) ctx.startingRef.value = false;
      if (err && err.status === 401) {
        ctx.setStarted(false);
        stopPolling(ctx);
        statusSet(ctx, "Unauthorized — sign in from the shell", "err");
        return;
      }
      // If the initial tail load flakes, fall back to polling (small batches) and
      // retry the tail load; this keeps startup fast and consistent without blocking.
      ctx.setStarted(false);
      statusSet(ctx, "Log load failed — retrying…", "err");
      startPolling(ctx);
      window.setTimeout(function () { startStreaming(ctx); }, 1500);
    });
}

function init(ctx) {
  window.addEventListener("scroll", function () {
    if (ctx.getViewMode() === "summarized") return;
    if (window.scrollY > 260) return;
    fetchOlderLogs(ctx);
  }, { passive: true });

  /** Summarized mode scroll lives on #panel-summarized (body overflow hidden); load older chunks when user reaches top. */
  var summarizedPanel = document.getElementById("panel-summarized");
  if (summarizedPanel) {
    summarizedPanel.addEventListener(
      "scroll",
      function () {
        if (ctx.getViewMode() !== "summarized") return;
        if (summarizedPanel.scrollTop > 260) return;
        fetchOlderLogs(ctx);
      },
      { passive: true }
    );
  }

  var rawTaAttach = document.getElementById("raw-logs-textarea");
  if (rawTaAttach) rawTaAttach.addEventListener("scroll", function (ev) {
    if (ctx.getViewMode() !== "raw_logs") return;
    var ta = ev.target;
    if (!ta || ta.scrollTop > 160) return;
    fetchOlderLogs(ctx);
  }, { passive: true });

  if (ctx.getEmbedded()) {
    window.addEventListener("message", function (ev) {
      if (ev.origin !== window.location.origin) return;
      var d = ev.data;
      if (d && d.type === "claudia-logs-activate") {
        if (d.view) {
          ctx.setViewMode(String(d.view));
          ctx.onViewModeChanged();
        }
        startStreaming(ctx);
      }
    });
  }
  // In embedded mode (desktop shell), message activation is best-effort; always start
  // streaming so the logs view never renders as "metrics only" due to a missed postMessage.
  startStreaming(ctx);
}

globalThis.ClaudiaLogs = globalThis.ClaudiaLogs || {};
globalThis.ClaudiaLogs.Transport = { init: init };

