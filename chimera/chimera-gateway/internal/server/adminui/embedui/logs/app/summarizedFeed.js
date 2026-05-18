/**
 * Summarized panel rebuild, service/conversation cards, and unified feed render.
 *
 * Exports: ChimeraLogs.App.mountSummarizedFeed(ctx)
 */

globalThis.ChimeraLogs = globalThis.ChimeraLogs || {};
globalThis.ChimeraLogs.App = globalThis.ChimeraLogs.App || {};
globalThis.ChimeraLogs.App.mountSummarizedFeed = function (ctx) {
  var C = ctx.contracts || (globalThis.ChimeraLogs && ChimeraLogs.Contracts) || {};
  var entryCache = ctx.entryCache;
  var getViewMode = ctx.getViewMode;
  var getFlat = ctx.getFlat;
  var escapeHtml = ctx.escapeHtml;
  var strHash = ctx.strHash;
  var entryInstant = ctx.entryInstant;
  var inferShape = ctx.inferShape;
  var normalizeServiceBucketKey = ctx.normalizeServiceBucketKey;
  var logSummaryHtml = ctx.logSummaryHtml;
  var primaryLogMessage = ctx.primaryLogMessage;
  var operatorFriendlyGatewayMsg = ctx.operatorFriendlyGatewayMsg;
  var buildHeadlineHtml = ctx.buildHeadlineHtml;
  var buildDetailsColumn = ctx.buildDetailsColumn;
  var buildLogsHref = ctx.buildLogsHref;
  var scheduleFocusTargets = ctx.scheduleFocusTargets;
  var stickPx = ctx.stickPx;
  var focusPrincipal = ctx.focusPrincipal;
  var focusConv = ctx.focusConv;
  var focusSeq = ctx.focusSeq;
  var focusCard = ctx.focusCard;
  var embedded = ctx.embedded;
  var GW_PROBES_LS = ctx.GW_PROBES_LS;
  var INDEXER_WATCH_ROOTS_LS = ctx.INDEXER_WATCH_ROOTS_LS;
  var RECENT_CARD_STATUS_N = ctx.RECENT_CARD_STATUS_N;
  var CONV_RECENT_N = ctx.CONV_RECENT_N;
  var sumEvlogRowTrHtml = ctx.sumEvlogRowTrHtml;
  var sumEvlogPanelHtml = ctx.sumEvlogPanelHtml;
  var sumEvlogBuildTbodyFromConvEvents = ctx.sumEvlogBuildTbodyFromConvEvents;
  var sumEvlogBuildTbodyFromServiceEntries = ctx.sumEvlogBuildTbodyFromServiceEntries;
  var sumEvlogVisibleEntriesForService = ctx.sumEvlogVisibleEntriesForService;
  var sumEvlogToolbarStaticHtml = ctx.sumEvlogToolbarStaticHtml;
  function summarizedEvlogInteractionBlocksRebuild() {
    if (Date.now() < ctx.sumEvlogPointerSuppressedUntil) return true;
    var a = document.activeElement;
    if (!a || !a.closest) return false;
    if (!a.closest("#panel-summarized")) return false;
    if (a.classList && a.classList.contains("sum-evlog__search")) return true;
    if (a.matches && a.matches("[data-evlog-filter-status]")) return true;
    if (
      a.id === "admin-routing-yaml" ||
      a.id === "admin-fallback-yaml" ||
      a.id === "admin-router-models-yaml" ||
      a.id === "admin-router-threshold"
    ) return true;
    return false;
  }

  function scheduleDeferredSummarizedRefresh() {
    if (ctx.sumEvlogUiDeferTimer) clearTimeout(ctx.sumEvlogUiDeferTimer);
    ctx.sumEvlogUiDeferTimer = setTimeout(function deferredSumEvlogRefresh() {
      ctx.sumEvlogUiDeferTimer = null;
      if (summarizedEvlogInteractionBlocksRebuild()) {
        ctx.sumEvlogUiDeferTimer = setTimeout(deferredSumEvlogRefresh, 300);
        return;
      }
      refreshSummarizedPanel();
    }, 300);
  }

  function refreshSummarizedPanel() {
    var psu = document.getElementById("panel-summarized");
    if (getViewMode() !== "summarized" || !psu) return;
    if (summarizedEvlogInteractionBlocksRebuild()) {
      scheduleDeferredSummarizedRefresh();
      return;
    }
    var prevScrollTop = psu.scrollTop;
    var prevScrollH = psu.scrollHeight;
    var nearPanelBottom =
      psu.scrollHeight - psu.scrollTop - psu.clientHeight <= stickPx;

    var openDetailIds = [];
    try {
      var dOpen = psu.querySelectorAll("details[open][id]");
      for (var di = 0; di < dOpen.length; di++) {
        if (dOpen[di].id) openDetailIds.push(dOpen[di].id);
      }
    } catch (e) { }

    var storyScroll = {};
    try {
      var sps = psu.querySelectorAll(".story-panel");
      for (var sj = 0; sj < sps.length; sj++) {
        var cStory = sps[sj].closest("details[id]");
        if (cStory && cStory.id) storyScroll[cStory.id] = sps[sj].scrollTop;
      }
    } catch (e1) { }

    /** Scroll for .sum-full-log[id] only; evlog tbody scroll lives in sumEvlog panel state (search/filter changes row height). */
    var fullLogScroll = {};
    try {
      var fls = psu.querySelectorAll(".sum-full-log[id]");
      for (var fk = 0; fk < fls.length; fk++) {
        if (fls[fk] && fls[fk].id) fullLogScroll[fls[fk].id] = fls[fk].scrollTop;
      }
    } catch (e2) { }

    var sumEvlogPanelSave = {};
    try {
      if (typeof globalThis.sumEvlogCapturePanelState === "function") {
        sumEvlogPanelSave = globalThis.sumEvlogCapturePanelState(psu) || {};
      }
    } catch (eEvCap) {
      sumEvlogPanelSave = {};
    }

    var gatewayMetricsTableScroll = [];
    try {
      var gwCap = document.getElementById("gw-usage-metrics");
      if (gwCap) {
        var wrapsC = gwCap.querySelectorAll(".sum-metrics-table-wrap");
        for (var wc = 0; wc < wrapsC.length; wc++) {
          gatewayMetricsTableScroll.push({ left: wrapsC[wc].scrollLeft, top: wrapsC[wc].scrollTop });
        }
      }
    } catch (e3) { }

    psu.innerHTML = renderSummarizedUnified();

    hydrateIndexerServiceSummaryFromApi();

    if (typeof globalThis.sumEvlogHydrateAllIn === "function") {
      try {
        globalThis.sumEvlogHydrateAllIn(psu);
      } catch (eEv) {}
    }

    for (var ri = 0; ri < openDetailIds.length; ri++) {
      var d = document.getElementById(openDetailIds[ri]);
      if (d && d.tagName === "DETAILS") d.open = true;
    }
    if (focusCard) {
      var focusId = "";
      if (focusCard === "admin" || focusCard === "access" || focusCard === "tokens" || focusCard === "users") focusId = "admin-users";
      else if (focusCard === "providers" || focusCard === "provider") focusId = "admin-provider-groq";
      else if (focusCard === "groq") focusId = "admin-provider-groq";
      else if (focusCard === "gemini") focusId = "admin-provider-gemini";
      else if (focusCard === "ollama") focusId = "admin-provider-ollama";
      else if (focusCard === "routing" || focusCard === "rules") focusId = "admin-routing-rules";
      else if (focusCard === "fallback" || focusCard === "fallbackchain") focusId = "admin-fallback-chain";
      else if (focusCard === "router" || focusCard === "router-model" || focusCard === "routermodel") focusId = "admin-router-model";
      if (focusId) {
        var fd = document.getElementById(focusId);
        if (fd && fd.tagName === "DETAILS") {
          fd.open = true;
          try { fd.scrollIntoView({ block: "start", behavior: "auto" }); } catch (_eFocus) {}
        }
      }
    }

    try {
      if (typeof globalThis.sumEvlogApplyPanelState === "function") {
        globalThis.sumEvlogApplyPanelState(psu, sumEvlogPanelSave, { scroll: false });
      }
    } catch (eEvApply) {}

    /** Best-effort outer scroll before paint: avoids scrollTop 0 flash while content height is still settling. */
    function applySummarizedOuterScrollSync() {
      if (nearPanelBottom) {
        psu.scrollTop = psu.scrollHeight;
      } else {
        var maxS = Math.max(0, psu.scrollHeight - psu.clientHeight);
        psu.scrollTop = Math.min(prevScrollTop, maxS);
      }
    }

    function restoreSummarizedNestedScrolls() {
      var gwR = document.getElementById("gw-usage-metrics");
      if (gwR && gatewayMetricsTableScroll.length) {
        var wrapsR = gwR.querySelectorAll(".sum-metrics-table-wrap");
        for (var mi = 0; mi < wrapsR.length && mi < gatewayMetricsTableScroll.length; mi++) {
          wrapsR[mi].scrollLeft = gatewayMetricsTableScroll[mi].left;
          wrapsR[mi].scrollTop = gatewayMetricsTableScroll[mi].top;
        }
      }
      for (var cid in storyScroll) {
        var cx = document.getElementById(cid);
        if (!cx) continue;
        var sp = cx.querySelector(".story-panel");
        if (sp) sp.scrollTop = storyScroll[cid];
      }
      for (var cid2 in fullLogScroll) {
        var fl = document.getElementById(cid2);
        if (!fl) continue;
        fl.scrollTop = fullLogScroll[cid2];
      }
    }

    applySummarizedOuterScrollSync();
    restoreSummarizedNestedScrolls();

    function finalizeSummarizedScrollAfterLayout() {
      restoreSummarizedNestedScrolls();
      if (nearPanelBottom) {
        psu.scrollTop = psu.scrollHeight;
      } else if (prevScrollH > 0) {
        var dh = psu.scrollHeight - prevScrollH;
        psu.scrollTop = Math.max(0, prevScrollTop + dh);
      }
      try {
        if (typeof globalThis.sumEvlogApplyPanelState === "function") {
          globalThis.sumEvlogApplyPanelState(psu, sumEvlogPanelSave, { scrollOnly: true });
        }
      } catch (eEvScroll) {}
    }
    window.requestAnimationFrame(finalizeSummarizedScrollAfterLayout);
  }

  window.__chimeraToggleGatewayProbes = function (on) {
    ctx.gatewayPanelShowProbes = !!on;
    try {
      localStorage.setItem(GW_PROBES_LS, ctx.gatewayPanelShowProbes ? "1" : "0");
    } catch (eTg) {}
    refreshSummarizedPanel();
  };

  /** Replace only the gateway metrics card so periodic /api/ui/metrics polls do not rebuild the whole feed. */
  function patchGatewayUsageMetricsCard() {
    if (getViewMode() !== "summarized") return;
    var psu = document.getElementById("panel-summarized");
    if (!psu) return;
    var oldEl = document.getElementById("gw-usage-metrics");
    if (!oldEl) {
      refreshSummarizedPanel();
      return;
    }
    var keepMainOpen = !!oldEl.open;
    var wrapsOld = oldEl.querySelectorAll(".sum-metrics-table-wrap");
    var tableScroll = [];
    for (var wi = 0; wi < wrapsOld.length; wi++) {
      tableScroll.push({ left: wrapsOld[wi].scrollLeft, top: wrapsOld[wi].scrollTop });
    }

    var wrap = document.createElement("div");
    wrap.innerHTML = buildGatewayUsageCardHtml().trim();
    var newEl = wrap.firstElementChild;
    if (!newEl || newEl.id !== "gw-usage-metrics") return;

    oldEl.parentNode.replaceChild(newEl, oldEl);

    newEl.open = keepMainOpen;
    var wrapsNew = newEl.querySelectorAll(".sum-metrics-table-wrap");
    for (var wj = 0; wj < wrapsNew.length && wj < tableScroll.length; wj++) {
      wrapsNew[wj].scrollLeft = tableScroll[wj].left;
      wrapsNew[wj].scrollTop = tableScroll[wj].top;
    }
  }

  /** Replace only the gateway overview card so /api/ui/state polls avoid full feed rebuilds. */
  function patchGatewayOverviewCard() {
    if (getViewMode() !== "summarized") return;
    var psu = document.getElementById("panel-summarized");
    if (!psu) return;
    var oldEl = document.getElementById("gw-overview");
    if (!oldEl) {
      refreshSummarizedPanel();
      return;
    }
    var keepOpen = !!oldEl.open;
    var wrap = document.createElement("div");
    wrap.innerHTML = buildGatewayOverviewCardHtml().trim();
    var newEl = wrap.firstElementChild;
    if (!newEl || newEl.id !== "gw-overview") return;
    oldEl.parentNode.replaceChild(newEl, oldEl);
    newEl.open = keepOpen;
  }

  function scheduleStoryRebuild() {
    if (ctx.storyRebuildTimer) clearTimeout(ctx.storyRebuildTimer);
    ctx.storyRebuildTimer = setTimeout(function () {
      ctx.storyRebuildTimer = null;
      refreshSummarizedPanel();
      scheduleFocusTargets();
    }, 80);
  }

  function formatInt(n) {
    if (n == null || isNaN(n)) return "—";
    try {
      return new Intl.NumberFormat().format(Math.round(n));
    } catch (e) {
      return String(Math.round(n));
    }
  }

  function aggregateRollupRows(rows) {
    if (!rows || !rows.length) return { models: 0, tokens: 0, calls: 0 };
    var seen = {};
    var tokens = 0;
    var calls = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var mid = r.model_id != null ? String(r.model_id) : "";
      if (mid) seen[mid] = true;
      tokens += Number(r.est_tokens) || 0;
      calls += Number(r.calls) || 0;
    }
    var nm = 0;
    for (var k in seen) {
      if (Object.prototype.hasOwnProperty.call(seen, k)) nm++;
    }
    return { models: nm, tokens: tokens, calls: calls };
  }

  function formatCompactTok(n) {
    if (n == null || isNaN(n)) return "—";
    var x = Number(n);
    if (x < 0) return "—";
    if (x >= 1000000) return (x / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M";
    if (x >= 100000) return Math.round(x / 1000) + "k";
    if (x >= 10000) return (x / 1000).toFixed(1).replace(/\.0$/, "") + "k";
    if (x >= 1000) return (x / 1000).toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "k";
    return formatInt(x);
  }

  function metricsRollupTableHtml(rows) {
    if (!rows || !rows.length) {
      return (
        '<div class="sum-metrics-table-wrap">' +
        '<table class="sum-metrics-table"><tbody>' +
        '<tr><td class="muted">No models used</td></tr>' +
        "</tbody></table></div>"
      );
    }
    var h = [];
    h.push(
      '<div class="sum-metrics-table-wrap"><table class="sum-metrics-table"><thead><tr><th>Provider</th><th>Model</th><th>HTTP</th><th class="num">Calls</th><th class="num">Est. tokens</th></tr></thead><tbody>'
    );
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      h.push(
        "<tr><td>" +
        escapeHtml(r.provider) +
        '</td><td><code class="sum-mono-id">' +
        escapeHtml(r.model_id) +
        '</code></td><td>' +
        escapeHtml(r.status) +
        '</td><td class="num">' +
        escapeHtml(r.calls) +
        '</td><td class="num">' +
        escapeHtml(r.est_tokens) +
        "</td></tr>"
      );
    }
    h.push("</tbody></table></div>");
    return h.join("");
  }

  function pad2Utc(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function formatUtcLikeLogTimestamp(tsOrDate) {
    if (tsOrDate === null || tsOrDate === undefined || tsOrDate === "") return "—";
    var d = tsOrDate instanceof Date ? tsOrDate : new Date(tsOrDate);
    if (isNaN(d.getTime())) return String(tsOrDate).replace("T", " ").slice(0, 23);
    return (
      d.getUTCFullYear() +
      "-" +
      pad2Utc(d.getUTCMonth() + 1) +
      "-" +
      pad2Utc(d.getUTCDate()) +
      " " +
      pad2Utc(d.getUTCHours()) +
      ":" +
      pad2Utc(d.getUTCMinutes()) +
      ":" +
      pad2Utc(d.getUTCSeconds())
    );
  }

  function formatUtcToMinute(tsOrDate) {
    if (tsOrDate === null || tsOrDate === undefined || tsOrDate === "") return "";
    var d = tsOrDate instanceof Date ? tsOrDate : new Date(tsOrDate);
    if (isNaN(d.getTime())) return String(tsOrDate).replace("T", " ").slice(0, 16);
    return (
      d.getUTCFullYear() +
      "-" +
      pad2Utc(d.getUTCMonth() + 1) +
      "-" +
      pad2Utc(d.getUTCDate()) +
      " " +
      pad2Utc(d.getUTCHours()) +
      ":" +
      pad2Utc(d.getUTCMinutes())
    );
  }

  function formatUtcToDay(tsOrDate) {
    if (tsOrDate === null || tsOrDate === undefined || tsOrDate === "") return "";
    var d = tsOrDate instanceof Date ? tsOrDate : new Date(tsOrDate);
    if (isNaN(d.getTime())) return String(tsOrDate).replace("T", " ").slice(0, 10);
    return d.getUTCFullYear() + "-" + pad2Utc(d.getUTCMonth() + 1) + "-" + pad2Utc(d.getUTCDate());
  }

  function metricsEventsTableHtml(rows) {
    if (!rows || !rows.length) {
      return '<p class="muted">No events recorded yet.</p>';
    }
    var h = [];
    h.push(
      '<div class="sum-metrics-table-wrap sum-metrics-events-scroll"><table class="sum-metrics-table"><thead><tr><th>Time (UTC)</th><th>Provider</th><th>Model</th><th>HTTP</th><th class="num">Est. tokens</th></tr></thead><tbody>'
    );
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      h.push(
        "<tr><td>" +
        escapeHtml(formatUtcLikeLogTimestamp(r.occurred_at)) +
        "</td><td>" +
        escapeHtml(r.provider) +
        '</td><td><code class="sum-mono-id">' +
        escapeHtml(r.model_id) +
        '</code></td><td>' +
        escapeHtml(r.status) +
        '</td><td class="num">' +
        escapeHtml(r.est_tokens) +
        "</td></tr>"
      );
    }
    h.push("</tbody></table></div>");
    return h.join("");
  }

  function fetchGatewayMetrics() {
    fetch("/api/ui/metrics?limit=150", { credentials: "same-origin" })
      .then(function (res) {
        if (res.status === 401) return null;
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        ctx.metricsCache = data;
        if (getViewMode() === "summarized") patchGatewayUsageMetricsCard();
      })
      .catch(function (e) {
        ctx.metricsCache = {
          metrics_store_open: false,
          message: e && e.message ? String(e.message) : String(e)
        };
        if (getViewMode() === "summarized") patchGatewayUsageMetricsCard();
      });
  }

  function syncMetricsPolling() {
    if (metricsPollTimer) {
      try {
        clearInterval(metricsPollTimer);
      } catch (x) { }
      metricsPollTimer = null;
    }
    if (getViewMode() !== "summarized") return;
    fetchGatewayMetrics();
    metricsPollTimer = setInterval(fetchGatewayMetrics, METRICS_POLL_MS);
  }

  function fetchGatewayOverview() {
    fetch("/api/ui/state", { credentials: "same-origin" })
      .then(function (res) {
        if (res.status === 401) return null;
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.gateway) return;
        ctx.gatewayOverviewCache = data.gateway;
        if (getViewMode() === "summarized") patchGatewayOverviewCard();
      })
      .catch(function (e) {
        ctx.gatewayOverviewCache = {
          _error: e && e.message ? String(e.message) : String(e)
        };
        if (getViewMode() === "summarized") patchGatewayOverviewCard();
      });
  }

  function syncGatewayOverviewPolling() {
    if (gatewayOverviewPollTimer) {
      try {
        clearInterval(gatewayOverviewPollTimer);
      } catch (x) {}
      gatewayOverviewPollTimer = null;
    }
    if (getViewMode() !== "summarized") return;
    fetchGatewayOverview();
    gatewayOverviewPollTimer = setInterval(fetchGatewayOverview, GATEWAY_OVERVIEW_POLL_MS);
  }

  function fetchChimeraBrokerProviderSnapshot() {
    fetch("/api/ui/chimera-broker/providers", { credentials: "same-origin" })
      .then(function (res) {
        if (res.status === 401) return null;
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        ctx.chimeraBrokerProviderSnapshot = { fetchedClientMs: Date.now(), data: data };
        if (getViewMode() === "summarized") patchChimeraBrokerProviderHealthStrip();
      })
      .catch(function () {
        // Keep any prior snapshot — staleness check in the renderer handles fallback.
      });
  }

  function syncChimeraBrokerProviderPolling() {
    if (chimeraBrokerProviderPollTimer) {
      try {
        clearInterval(chimeraBrokerProviderPollTimer);
      } catch (x) { }
      chimeraBrokerProviderPollTimer = null;
    }
    if (getViewMode() !== "summarized") return;
    fetchChimeraBrokerProviderSnapshot();
    chimeraBrokerProviderPollTimer = setInterval(fetchChimeraBrokerProviderSnapshot, CHIMERA_BROKER_PROVIDER_POLL_MS);
  }

  /** Replace chimera-broker provider health UI after a snapshot poll (expanded strip + collapsed summary indicators). */
  function patchChimeraBrokerProviderHealthStrip() {
    if (getViewMode() !== "summarized") return;
    var arr = collectChimeraBrokerBufferForStrip();
    var oldEl = document.getElementById("chimera-broker-provider-health-strip");
    if (oldEl) {
      var wrap = document.createElement("div");
      wrap.innerHTML = chimeraBrokerProviderHealthStripHtml(arr).trim();
      var newEl = wrap.firstElementChild;
      if (newEl && newEl.id === "chimera-broker-provider-health-strip") {
        oldEl.parentNode.replaceChild(newEl, oldEl);
      }
    }
    var compactOld = document.getElementById("chimera-broker-provider-health-compact");
    if (compactOld) {
      var w2 = document.createElement("div");
      w2.innerHTML = chimeraBrokerProviderHealthStripHtml(arr, { compact: true }).trim();
      var n2 = w2.firstElementChild;
      if (n2 && n2.id === "chimera-broker-provider-health-compact") {
        compactOld.parentNode.replaceChild(n2, compactOld);
      }
    }
  }

  /** Mirror the chimera-broker-bucket selection in refreshSummarizedPanel so the patched strip's
   *  log-derived fallback sees the same arr the original renderExpandedService("chimera-broker") saw. */
  function collectChimeraBrokerBufferForStrip() {
    var out = [];
    for (var i = 0; i < entryCache.length; i++) {
      var e = entryCache[i];
      if (!e || !e.parsed) continue;
      var f = getFlat(e.parsed);
      var svc = f.service ? String(f.service) : "";
      var isChimeraBroker = svc === "chimera-broker" || (e.source === "chimera-broker") || entryRoutesToChimeraBrokerBucket(e);
      if (isChimeraBroker) out.push(e);
    }
    return out;
  }

  /** Explainer strip at top of the Gateway usage metrics card (/api/ui/metrics). */
  function buildGatewayUsageIntroHtml() {
    return (
      '<div class="gw-usage-intro" id="gw-usage-intro">' +
      '<p class="gw-usage-intro-lead">' +
      "Which models ran, estimated tokens this UTC minute and calendar day, and the latest upstream calls." +
      "</p>" +
      '<p class="gw-usage-intro-follow">' +
      "Use this to spot load before quotas hard-stop traffic. The gateway compares these rollups to the ceilings in your limits file — counts are directional estimates; each vendor bills differently." +
      "</p>" +
      '<ul class="gw-usage-intro-bullets">' +
      "<li>" +
      '<a class="sum-ext-link" href="https://console.groq.com/docs/rate-limits" rel="noopener noreferrer">Groq rate limits</a>' +
      " and " +
      '<a class="sum-ext-link" href="https://ai.google.dev/gemini-api/docs/pricing" rel="noopener noreferrer">Gemini pricing &amp; free tier</a>' +
      " pages inform scraped free-tier hints." +
      "</li>" +
      "<li>" +
      "Ceiling tables live in " +
      '<a href="#" class="sum-proj-path" data-rel="config/provider-model-limits.yaml"><code>config/provider-model-limits.yaml</code></a>' +
      "; the gateway applies rollups against them when metrics are enabled." +
      "</li>" +
      "</ul>" +
      "</div>"
    );
  }

  /** Explainer strip at top of the Gateway service card (Services → Gateway). */
  function buildGatewayCardIntroHtml() {
    return (
      '<div class="gw-svc-card-intro" id="gw-svc-card-intro">' +
      '<p class="gw-svc-card-intro-lead">' +
      "An at-a-glance snapshot of this gateway instance—how it listens, where it connects, which supervised helpers started, and light traffic counts from gateway lines in the current view. For richer token rollups and upstream trails, open Gateway usage (Stats); figures here only cover lines loaded in this window." +
      "</p>" +
      "</div>"
    );
  }

  /** Explainer strip at top of the chimera-broker relay card (mirrors buildGatewayUsageIntroHtml). */
  function buildBrokerCardIntroHtml () {
    return (
      '<div class="bf-card-intro" id="bf-card-intro">' +
      '<p class="bf-card-intro-lead">' +
      "A fast health and traffic summary for the chimera-broker relay path into models. Odd patterns here usually mean throttling, misconfiguration, or an upstream hiccup—not necessarily that chat is already broken." +
      "</p>" +
      "</div>"
    );
  }

  /** Explainer strip at top of the chimera-vectorstore service card (mirrors the gateway / broker intros). */
  function buildVectorstoreCardIntroHtml() {
    return (
      '<div class="qd-card-intro" id="qd-card-intro">' +
      '<p class="qd-card-intro-lead">' +
      "chimera-vectorstore is the local vector store service the indexer fills and retrieval queries—this strip shows whether the wrapper is up and whether writes and searches are succeeding. Weak numbers here often mean thinner RAG before chat complains; counts reflect what the API reported, not a full on-disk audit." +
      "</p>" +
      "</div>"
    );
  }

  /** Explainer strip at top of the Indexer service card (mirrors gateway / broker / vectorstore intros). */
  function buildIndexerCardIntroHtml() {
    return (
      '<div class="ix-card-intro" id="ix-card-intro">' +
      '<p class="ix-card-intro-lead">' +
      "A quick read on how the supervised indexer is keeping watched trees in sync—backlog, throughput, and per-file outcomes at a glance. When those numbers drift the wrong way, retrieval can go stale; pauses and skips shown here are intentional signals, not silent drops." +
      "</p>" +
      "</div>"
    );
  }

  function findWorkspaceDraft(id) {
    for (var i = 0; i < ctx.workspaceDrafts.length; i++) {
      if (ctx.workspaceDrafts[i].id === id) return ctx.workspaceDrafts[i];
    }
    return null;
  }

  function removeWorkspaceDraft(id) {
    var next = [];
    for (var i = 0; i < ctx.workspaceDrafts.length; i++) {
      if (ctx.workspaceDrafts[i].id !== id) next.push(ctx.workspaceDrafts[i]);
    }
    ctx.workspaceDrafts = next;
  }

  function notifyWorkspaceDraftMsg(msg, isErr) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.className = msg ? (isErr ? "workspace-draft-status workspace-draft-status--err" : "workspace-draft-status") : "";
    if (msg && !isErr) {
      try {
        window.clearTimeout(notifyWorkspaceDraftMsg._t);
      } catch (_e) {}
      notifyWorkspaceDraftMsg._t = window.setTimeout(function () {
        if (statusEl && statusEl.textContent === msg) {
          statusEl.textContent = "";
          statusEl.className = "";
        }
      }, 4800);
    }
  }

  function dirBasenameForWorkspace(p) {
    if (!p) return "";
    var s = String(p).replace(/[/\\]+$/, "");
    var i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
    return i >= 0 ? s.slice(i + 1) : s;
  }

  function nativeFolderPickerFn() {
    try {
      var topw = window.top;
      if (topw && typeof topw.chimeraPickFolder === "function") return topw.chimeraPickFolder;
    } catch (e) {}
    return typeof window.chimeraPickFolder === "function" ? window.chimeraPickFolder : null;
  }

  function syncWorkspaceDraftHeader(cardEl, d) {
    if (!cardEl || !d) return;
    var u = cardEl.querySelector(".ws-draft-lbl-user");
    var p = cardEl.querySelector(".ws-draft-lbl-proj");
    var f = cardEl.querySelector(".ws-draft-lbl-flav");
    var ulab = resolveLogsOperatorUserLabel();
    if (u) u.textContent = ulab !== "—" ? ulab : "";
    if (p) p.textContent = String(d.projectId != null ? d.projectId : "").trim();
    if (f) f.textContent = String(d.flavorId != null ? d.flavorId : "").trim();
  }

  function buildWorkspaceDraftCardHtml(d) {
    var uid = "ws-draft-" + d.id;
    var ulab = resolveLogsOperatorUserLabel();
    var projShown = String(d.projectId != null ? d.projectId : "").trim();
    var flavShown = String(d.flavorId != null ? d.flavorId : "").trim();
    var titleBits =
      '<span class="ws-draft-head-inline">' +
      '<span class="ws-draft-lbl ws-draft-lbl-user">' +
      (ulab !== "—" ? escapeHtml(ulab) : "") +
      "</span>" +
      '<span class="ws-draft-sep muted">·</span>' +
      '<span class="ws-draft-lbl ws-draft-lbl-proj">' +
      escapeHtml(projShown) +
      "</span>" +
      '<span class="ws-draft-sep muted">·</span>' +
      '<span class="ws-draft-lbl ws-draft-lbl-flav">' +
      escapeHtml(flavShown) +
      "</span>" +
      "</span>";
    var paths = d.paths && d.paths.length ? d.paths : [];
    var rmDisabledAttr = paths.length ? "" : " disabled";
    var selOpts = "";
    for (var pi = 0; pi < paths.length; pi++) {
      selOpts +=
        '<option value="' +
        pi +
        '">' +
        escapeHtml(paths[pi]) +
        "</option>";
    }
    var prVal = escapeHtml(String(d.projectId != null ? d.projectId : ""));
    var fvVal = escapeHtml(String(d.flavorId != null ? d.flavorId : ""));
    return (
      '<article class="sum-card sum-card--workspace-draft" id="' +
      escapeHtml(uid) +
      '" data-workspace-draft="' +
      String(d.id) +
      '">' +
      '<header class="sum-card__workspace-draft-hdr">' +
      '<span class="sum-avatar sum-av-c" title="New workspace">+</span>' +
      '<span class="sum-main sum-main--workspace-draft">' +
      '<span class="sum-title">' +
      titleBits +
      "</span>" +
      "</span>" +
      '<span class="ws-draft-actions">' +
      '<button type="button" class="ws-draft-btn ws-draft-btn-cancel">Cancel</button>' +
      '<button type="button" class="ws-draft-btn ws-draft-btn-save">Save</button>' +
      "</span>" +
      "</header>" +
      '<div class="sum-body">' +
      '<div class="ws-draft-fields">' +
      '<div class="ws-draft-field">' +
      '<label class="ws-draft-field-label" for="' +
      escapeHtml(uid) +
      '-pr">Project id</label>' +
      '<input id="' +
      escapeHtml(uid) +
      '-pr" class="ws-draft-input" type="text" autocomplete="off" data-ws-field="project" value="' +
      prVal +
      '" />' +
      "</div>" +
      '<div class="ws-draft-field">' +
      '<label class="ws-draft-field-label" for="' +
      escapeHtml(uid) +
      '-fv">Flavor id</label>' +
      '<input id="' +
      escapeHtml(uid) +
      '-fv" class="ws-draft-input" type="text" autocomplete="off" data-ws-field="flavor" value="' +
      fvVal +
      '" />' +
      "</div>" +
      "</div>" +
      '<div class="sum-section-label">Watched paths</div>' +
      '<div class="ws-draft-paths-row">' +
      '<select class="ws-draft-paths-select" size="6" aria-label="Watched paths" data-ws-draft-paths="' +
      String(d.id) +
      '">' +
      selOpts +
      "</select>" +
      '<div class="ws-draft-path-btns">' +
      '<button type="button" class="ws-draft-btn ws-draft-btn-add">Add</button>' +
      '<button type="button" class="ws-draft-btn ws-draft-btn-remove"' +
      rmDisabledAttr +
      ">Remove</button>" +
      "</div>" +
      "</div>" +
      '<p class="muted ws-draft-hint">Folder picker requires the Chimera desktop shell (or an environment that exposes <code>chimeraPickFolder</code>).</p>' +
      "</div>" +
      "</article>"
    );
  }

  function saveWorkspaceDraftById(draftId) {
    var d = findWorkspaceDraft(draftId);
    if (!d) return;
    var pj = String(d.projectId != null ? d.projectId : "").trim();
    var fv = String(d.flavorId != null ? d.flavorId : "").trim();
    if (!pj) {
      notifyWorkspaceDraftMsg("Project id is required.", true);
      return;
    }
    if (!d.paths || !d.paths.length) {
      notifyWorkspaceDraftMsg("Add at least one watched path.", true);
      return;
    }
    fetch("/api/ui/indexer/workspaces", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: pj,
        flavor_id: fv,
        paths: d.paths.slice()
      })
    })
      .then(function (res) {
        return res.json().then(function (j) {
          if (!res.ok) throw new Error((j && j.error) || res.statusText || "save failed");
          return j;
        });
      })
      .then(function (j) {
        removeWorkspaceDraft(draftId);
        notifyWorkspaceDraftMsg("Workspace saved.", false);
        if (j && Array.isArray(j.roots)) {
          ctx.lastIndexerOperatorRoots = j.roots;
          try {
            ctx.lastIndexerOperatorRootsJson = JSON.stringify(j.roots);
          } catch (_eSaveRoots) {
            ctx.lastIndexerOperatorRootsJson = "";
          }
        }
        if (j && j.workspace && typeof j.workspace === "object") {
          mergeWorkspaceIntoOperatorNested(j.workspace);
        } else if (j && Array.isArray(j.roots)) {
          ctx.lastIndexerOperatorWorkspacesNested = dedupeOperatorWorkspacesNested(
            deriveNestedWorkspacesFromFlatRoots(j.roots)
          );
        }
        hydrateIndexerServiceSummaryFromApi();
        scheduleStoryRebuild();
      })
      .catch(function (err) {
        notifyWorkspaceDraftMsg(err && err.message ? err.message : String(err), true);
      });
  }

  function appendWorkspaceDraftPath(d, absPath) {
    var p = String(absPath || "").trim();
    if (!p) return;
    if (!d.paths) d.paths = [];
    var qi;
    for (qi = 0; qi < d.paths.length; qi++) {
      if (d.paths[qi] === p) return;
    }
    d.paths.push(p);
    var pjBlank = !String(d.projectId != null ? d.projectId : "").trim();
    if (pjBlank) {
      var base = dirBasenameForWorkspace(p);
      d.projectId = base;
      d.flavorId = "";
    }
  }

  function pickFolderForWorkspaceDraft(startDir) {
    var fn = nativeFolderPickerFn();
    if (!fn) {
      notifyWorkspaceDraftMsg("Folder picker requires the Chimera desktop app (chimeraPickFolder).", true);
      return Promise.resolve("");
    }
    var sd = startDir != null && startDir !== undefined ? String(startDir) : "";
    return Promise.resolve(fn(sd)).then(function (path) {
      return (path && String(path).trim()) || "";
    });
  }

  /** Intro copy for the summarized-feed Workspaces section (replaces per-card blurbs). */
  function buildWorkspacesSectionIntroHtml() {
    return (
      '<div class="sum-workspaces-intro">' +
      '<p class="sum-workspaces-intro-lead">' +
      "Find the right snippets and docs while you work, without you pasting whole files into the chat. Point it at the places you care about, and it stays quietly up to date." +
      "</p>" +
      "</div>"
    );
  }

  function overviewStatePillClass(state) {
    var s = String(state || "").toLowerCase();
    if (s === "ok" || s === "up") return "sum-st-active";
    if (s === "degraded" || s === "down" || s === "unavailable") return "sum-st-error";
    return "sum-st-monitor";
  }

  function gatewayServiceHealthTone(raw) {
    var s = String(raw || "").trim().toLowerCase();
    if (
      s === "up" ||
      s === "ok" ||
      s === "healthy" ||
      s === "ready" ||
      s === "running" ||
      s === "enabled" ||
      s === "supervised"
    ) {
      return "up";
    }
    if (s === "down" || s === "degraded" || s === "unavailable" || s === "error" || s === "failed" || s === "disabled") {
      return "down";
    }
    return "unknown";
  }

  function gatewayServiceHealthEntries(ov) {
    var bf = ov && ov["chimera-broker"] ? ov["chimera-broker"] : {};
    var qd = ov && ov["chimera-vectorstore"] ? ov["chimera-vectorstore"] : {};
    var ix = ov && ov["chimera-indexer"] ? ov["chimera-indexer"] : {};
    return [
      { id: "chimera-gateway", raw: "up" },
      { id: "chimera-broker", raw: bf.state },
      { id: "chimera-vectorstore", raw: qd.state },
      { id: "chimera-indexer", raw: ix.worker }
    ];
  }

  /**
   * Gateway service-health strip: compact in collapsed summary row, full strip in expanded body.
   */
  function gatewayServiceHealthStripHtml(ov, opts) {
    opts = opts || {};
    var compact = !!opts.compact;
    var list = gatewayServiceHealthEntries(ov);
    var stateColor = { up: "#66bb6a", down: "#ef5350", unknown: "#bdbdbd" };
    var stateLabel = { up: "up", down: "down", unknown: "unknown" };
    var segs = [];
    var labels = [];
    for (var i = 0; i < list.length; i++) {
      var ent = list[i] || {};
      var tone = gatewayServiceHealthTone(ent.raw);
      var lab = stateLabel[tone];
      var title = String(ent.id || "service") + " · " + lab + (ent.raw != null && ent.raw !== "" ? " (" + String(ent.raw) + ")" : "");
      segs.push(
        '<span class="sum-bf-prov-health-seg" title="' +
          escapeHtml(title) +
          '" style="background:' +
          stateColor[tone] +
          '"></span>'
      );
      if (!compact) {
        labels.push(
          '<span class="sum-bf-prov-health-label" title="' +
            escapeHtml(title) +
            '">' +
            escapeHtml(String(ent.id || "—")) +
            "</span>"
        );
      }
    }
    if (compact) {
      return (
        '<div class="sum-bf-prov-health-root sum-bf-prov-health-root--compact" role="img" aria-label="service health">' +
        '<div class="sum-bf-prov-health-track sum-bf-prov-health-track--compact" title="service health">' +
        segs.join("") +
        "</div></div>"
      );
    }
    return (
      '<div class="sum-bf-prov-health-root" id="gateway-service-health-strip">' +
      '<div class="sum-bf-prov-health-track" title="Service health: chimera-gateway, chimera-broker, chimera-vectorstore, chimera-indexer">' +
      segs.join("") +
      '</div><div class="sum-bf-prov-health-labels">' +
      labels.join("") +
      "</div></div>"
    );
  }

  function buildGatewayOverviewCardHtml() {
    var data = ctx.gatewayOverviewCache;
    var loading = !data;
    var hasErr = !!(data && data._error);
    var semver = data && data.semver ? String(data.semver) : "—";
    var virtualModel = data && data.virtual_model_id ? String(data.virtual_model_id) : "—";
    var ov = data && data.service_overview ? data.service_overview : null;
    var compactHealth = gatewayServiceHealthStripHtml(ov, { compact: true });
    var sub;
    if (loading) {
      sub = '<span class="sum-sub sum-sub--clamp muted">Loading overview…</span>';
    } else if (hasErr) {
      sub = '<span class="sum-sub sum-sub--clamp muted">Overview unavailable — using last known logs.</span>';
    } else {
      sub = '<span class="sum-sub sum-sub--clamp">Main-surface parity: version, virtual model, and service health.</span>';
    }
    var body = "";
    if (loading) {
      body = '<p class="muted">Fetching /api/ui/state…</p>';
    } else if (hasErr) {
      body = '<p class="muted">' + escapeHtml(String(data._error || "overview unavailable")) + "</p>";
    } else {
      var refAt = ov && ov.refreshed_at ? formatUtcLikeLogTimestamp(ov.refreshed_at) : "—";
      body =
        '<div class="sum-section-label">Service health</div>' +
        gatewayServiceHealthStripHtml(ov) +
        '<dl class="indexer-run-kv indexer-run-kv--gateway-summary">' +
        "<dt>version</dt><dd><code class=\"sum-mono-id\">" + escapeHtml(semver) + "</code></dd>" +
        "<dt>virtual model</dt><dd><code class=\"sum-mono-id\">" + escapeHtml(virtualModel) + "</code></dd>" +
        "<dt>updated</dt><dd>" + escapeHtml(refAt) + "</dd>" +
        "</dl>";
    }
    return (
      '<details class="sum-card" id="gw-overview">' +
      "<summary>" +
      '<span class="sum-avatar sum-av-svc-gateway">GW</span>' +
      '<span class="sum-main"><span class="sum-title">Overview</span>' +
      sub +
      "</span>" +
      compactHealth +
      '<span class="sum-chev"></span></summary>' +
      '<div class="sum-body">' + body + "</div></details>"
    );
  }

  function buildGatewayOverviewFeedSection() {
    return (
      '<div class="sum-feed-section">' +
      buildGatewayOverviewCardHtml() +
      buildGatewayUsageCardHtml() +
      "</div>"
    );
  }

  function fallbackChainToYAML(ids) {
    if (!ids || !ids.length) return "";
    return ids
      .map(function (id) {
        var s = String(id);
        if (/^[\w./-]+$/.test(s)) return "- " + s;
        return "- " + JSON.stringify(s);
      })
      .join("\n");
  }

  function parseFallbackChainInput(text) {
    var t = String(text || "").trim();
    if (t.length > 0 && t[0] === "[") {
      try {
        var j = JSON.parse(t);
        if (Array.isArray(j)) return j.map(function (x) { return String(x); });
      } catch (_e) {}
    }
    var lines = String(text || "").split(/\r?\n/);
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/#.*$/, "").trim();
      if (!line) continue;
      if (line[0] !== "-") throw new Error("each non-empty line must start with '-' (line " + (i + 1) + ")");
      var rest = line.slice(1).trim();
      if (!rest) throw new Error("empty list item (line " + (i + 1) + ")");
      if (rest[0] === '"') {
        try {
          out.push(JSON.parse(rest));
        } catch (e) {
          throw new Error("bad double-quoted string (line " + (i + 1) + "): " + e.message);
        }
        continue;
      }
      if (rest[0] === "'") {
        if (rest.length < 2 || rest[rest.length - 1] !== "'") throw new Error("unclosed single-quoted string (line " + (i + 1) + ")");
        out.push(rest.slice(1, -1).replace(/''/g, "'"));
        continue;
      }
      out.push(rest);
    }
    return out;
  }

  function adminSetMessage(kind, msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
    statusEl.className = msg ? (kind === "err" ? "status-line err" : "status-line") : "status-line";
  }

  function adminPostJSON(url, body) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) throw new Error("Unauthorized");
        if (!r.ok) throw new Error((j && (j.error || (j.error && j.error.message))) || ("HTTP " + r.status));
        return j;
      });
    });
  }

  function fetchAdminState() {
    return fetch("/api/ui/state", { credentials: "same-origin" })
      .then(function (r) {
        if (r.status === 401) return null;
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        if (!j) return;
        ctx.adminStateCache = j;
      });
  }

  function fetchAdminTokens() {
    return fetch("/api/ui/tokens", { credentials: "same-origin" })
      .then(function (r) {
        if (r.status === 401) return null;
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        if (!j) return;
        ctx.tokenListCache = Array.isArray(j.tokens) ? j.tokens : [];
        for (var i = 0; i < ctx.tokenListCache.length; i++) {
          var row = ctx.tokenListCache[i] || {};
          var tid = row.tenant_id != null ? String(row.tenant_id).trim() : "";
          var tok = row.token != null ? String(row.token).trim() : "";
          if (tid && tok) ctx.adminCreatedTokenByTenant[tid] = tok;
        }
      });
  }

  function syncAdminStatePolling() {
    if (adminStatePollTimer) {
      try { clearInterval(adminStatePollTimer); } catch (_e) {}
      adminStatePollTimer = null;
    }
    if (getViewMode() !== "summarized") return;
    Promise.all([fetchAdminState(), fetchAdminTokens()])
      .then(function () { if (getViewMode() === "summarized") refreshSummarizedPanel(); })
      .catch(function (e) { adminSetMessage("err", e && e.message ? e.message : String(e)); });
    adminStatePollTimer = setInterval(function () {
      Promise.all([fetchAdminState(), fetchAdminTokens()])
        .then(function () { if (getViewMode() === "summarized") refreshSummarizedPanel(); })
        .catch(function () {});
    }, ADMIN_STATE_POLL_MS);
  }

  function providerRowsHtml(providerId, p) {
    var rows = p && Array.isArray(p.keys) ? p.keys : [];
    if (!rows.length) return '<li class="muted">No keys yet.</li>';
    var out = "";
    for (var i = 0; i < rows.length; i++) {
      var nm = rows[i] && rows[i].name != null ? String(rows[i].name) : "";
      out +=
        '<li><code>' + escapeHtml(nm || "(unnamed)") + "</code> · " + escapeHtml((rows[i] && rows[i].key_hint) || "—") +
        ' <button type="button" class="sg-op-btn sg-op-btn--small sg-op-btn--danger sg-op-btn--pill" data-admin-action="provider-key-delete" data-provider="' + escapeHtml(providerId) + '" data-name="' + escapeHtml(nm) + '">Remove</button></li>';
    }
    return out;
  }

  function adminProviderIntro(providerId, subtitle) {
    var links = {
      groq: { href: "https://groq.com/", label: "groq.com" },
      gemini: { href: "https://ai.google.dev/gemini-api/docs", label: "Gemini API docs" },
      ollama: { href: "https://ollama.com/", label: "ollama.com" }
    };
    var meta = links[providerId] || null;
    var out = '<p class="sg-op-provider-intro">' + escapeHtml(subtitle || "");
    if (meta) {
      out += ' Public reference: <a href="' + escapeHtml(meta.href) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(meta.label) + "</a>.";
    }
    return out + "</p>";
  }

  function adminProviderAvatarClass(providerId) {
    if (providerId === "groq") return "sum-av-a";
    if (providerId === "gemini") return "sum-av-b";
    if (providerId === "ollama") return "sum-av-c";
    return "sum-av-svc-chimera-broker";
  }

  function adminProviderHealthEntry(providerId) {
    if (!providerId || !ctx.chimeraBrokerProviderSnapshot || !ctx.chimeraBrokerProviderSnapshot.data || !Array.isArray(ctx.chimeraBrokerProviderSnapshot.data.providers)) {
      return null;
    }
    var snapshotAgeMs = Date.now() - Number(ctx.chimeraBrokerProviderSnapshot.fetchedClientMs || 0);
    if (snapshotAgeMs > CHIMERA_BROKER_PROVIDER_STALE_MS) return null;
    var list = ctx.chimeraBrokerProviderSnapshot.data.providers;
    for (var i = 0; i < list.length; i++) {
      var row = list[i] || {};
      if (String(row.id || "").toLowerCase() === String(providerId).toLowerCase()) return row;
    }
    return null;
  }

  function adminProviderAvailabilityHtml(providerId, fallbackOk) {
    var hp = adminProviderHealthEntry(providerId);
    var st = hp && hp.state ? String(hp.state).toLowerCase() : (fallbackOk ? "up" : "unknown");
    var map = {
      up: { cls: "sum-st-active", label: "reachable" },
      key_missing: { cls: "sum-st-monitor", label: "key missing" },
      down: { cls: "sum-st-error", label: "down" },
      unknown: { cls: "sum-st-monitor", label: "unknown" }
    };
    var meta = map[st] || map.unknown;
    return '<span class="sum-status ' + meta.cls + '">' + escapeHtml(meta.label) + "</span>";
  }

  function adminProviderModelCount(providerId) {
    var listed = adminProviderCatalogModels(providerId);
    if (listed.length) return listed.length;
    var data = ctx.metricsCache || {};
    var rows = [];
    if (Array.isArray(data.day_rollups) && data.day_rollups.length) rows = data.day_rollups;
    else if (Array.isArray(data.minute_rollups) && data.minute_rollups.length) rows = data.minute_rollups;
    var seen = {};
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var rp = String(r.provider || "").toLowerCase();
      var mid = String(r.model_id || "");
      if (rp && rp !== String(providerId).toLowerCase()) continue;
      if (!rp && mid.toLowerCase().indexOf(String(providerId).toLowerCase() + "/") !== 0) continue;
      if (mid) seen[mid] = true;
    }
    var n = 0;
    for (var k in seen) {
      if (Object.prototype.hasOwnProperty.call(seen, k)) n++;
    }
    return n;
  }

  function countRoutingRulesFromYAML(yamlText) {
    var src = String(yamlText || "");
    if (!src.trim()) return 0;
    var lines = src.split(/\r?\n/);
    var inRules = false;
    var rulesIndent = 0;
    var itemIndent = -1;
    var n = 0;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (!inRules) {
        var mHead = /^(\s*)rules\s*:\s*$/.exec(ln);
        if (mHead) {
          inRules = true;
          rulesIndent = mHead[1].length;
        }
        continue;
      }
      if (!ln.trim()) continue;
      var indent = ln.match(/^\s*/)[0].length;
      if (indent <= rulesIndent && /^[^\s#]/.test(ln)) break;
      if (!/^\s*-\s+/.test(ln)) continue;
      if (itemIndent < 0) itemIndent = indent;
      if (indent === itemIndent) n++;
    }
    return n;
  }

  function parseRoutingYamlScalar(value) {
    var s = String(value || "").replace(/#.*$/, "").trim();
    if (!s) return "";
    if (s[0] === '"') {
      try { return String(JSON.parse(s)); } catch (_eScalar) {}
    }
    if (s[0] === "'" && s[s.length - 1] === "'") {
      return s.slice(1, -1).replace(/''/g, "'");
    }
    return s;
  }

  function parseRoutingRulesFromYAML(yamlText) {
    var src = String(yamlText || "");
    if (!src.trim()) return [];
    var lines = src.split(/\r?\n/);
    var inRules = false;
    var rulesIndent = 0;
    var out = [];
    var cur = null;
    var itemIndent = -1;
    var inWhen = false;
    var whenIndent = 0;
    var inModels = false;
    var modelsIndent = 0;

    function pushCurrent() {
      if (!cur) return;
      out.push(cur);
      cur = null;
    }

    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i] || "";
      if (!inRules) {
        var mHead = /^(\s*)rules\s*:\s*$/.exec(ln);
        if (mHead) {
          inRules = true;
          rulesIndent = mHead[1].length;
        }
        continue;
      }
      if (!ln.trim()) continue;
      var indent = ln.match(/^\s*/)[0].length;
      if (indent <= rulesIndent && /^[^\s#]/.test(ln)) break;

      var mItem = /^\s*-\s*(.*)$/.exec(ln);
      if (mItem) {
        if (itemIndent < 0) itemIndent = indent;
        if (indent !== itemIndent) {
          if (inModels) {
            var midNested = parseRoutingYamlScalar(mItem[1]);
            if (midNested) cur.models.push(midNested);
          }
          continue;
        }
        pushCurrent();
        cur = {
          name: "unnamed",
          whenInline: "",
          whenParts: [],
          models: []
        };
        inWhen = false;
        inModels = false;
        var itemRest = String(mItem[1] || "").trim();
        if (itemRest) {
          var mNameInline = /^name\s*:\s*(.*)$/.exec(itemRest);
          var mWhenInline = /^when\s*:\s*(.*)$/.exec(itemRest);
          var mModelsInline = /^models\s*:\s*(.*)$/.exec(itemRest);
          if (mNameInline) cur.name = parseRoutingYamlScalar(mNameInline[1]) || "unnamed";
          else if (mWhenInline) cur.whenInline = parseRoutingYamlScalar(mWhenInline[1]);
          else if (mModelsInline) {
            var mv = parseRoutingYamlScalar(mModelsInline[1]);
            if (mv && mv !== "[]") cur.models.push(mv);
            inModels = !String(mModelsInline[1] || "").trim();
            modelsIndent = indent;
          }
        }
        continue;
      }
      if (!cur) continue;

      if (inWhen && indent <= whenIndent) inWhen = false;
      if (inModels && indent <= modelsIndent) inModels = false;

      var mName = /^\s*name\s*:\s*(.*)$/.exec(ln);
      if (mName) {
        cur.name = parseRoutingYamlScalar(mName[1]) || cur.name || "unnamed";
        continue;
      }

      var mWhen = /^\s*when\s*:\s*(.*)$/.exec(ln);
      if (mWhen) {
        var whenRest = String(mWhen[1] || "").trim();
        cur.whenInline = parseRoutingYamlScalar(whenRest);
        inWhen = !whenRest;
        whenIndent = indent;
        inModels = false;
        continue;
      }

      var mModels = /^\s*models\s*:\s*$/.exec(ln);
      if (mModels) {
        inModels = true;
        modelsIndent = indent;
        inWhen = false;
        continue;
      }

      if (inWhen) {
        var whenLn = ln.replace(/^\s+/, "").trim();
        if (whenLn && whenLn[0] !== "#") cur.whenParts.push(whenLn);
        continue;
      }

      if (inModels) {
        var mModel = /^\s*-\s*(.+)$/.exec(ln);
        if (mModel) {
          var mid = parseRoutingYamlScalar(mModel[1]);
          if (mid) cur.models.push(mid);
        }
      }
    }

    pushCurrent();
    return out;
  }

  function adminPrincipalForFlat(f) {
    if (!f) return "";
    return String(f.tenant_id || f.principal_id || f.tenant || "").trim();
  }

  function adminExtractProviderModel(mid) {
    var s = String(mid || "").trim();
    var slash = s.indexOf("/");
    if (slash <= 0) return { provider: "", model: s };
    return { provider: s.slice(0, slash), model: s.slice(slash + 1) };
  }

  function adminProviderCatalogModels(providerId) {
    var pid = String(providerId || "").toLowerCase();
    if (!pid) return [];
    if (!ctx.chimeraBrokerProviderSnapshot || !ctx.chimeraBrokerProviderSnapshot.data || !Array.isArray(ctx.chimeraBrokerProviderSnapshot.data.providers)) return [];
    var snapshotAgeMs = Date.now() - Number(ctx.chimeraBrokerProviderSnapshot.fetchedClientMs || 0);
    if (snapshotAgeMs > CHIMERA_BROKER_PROVIDER_STALE_MS) return [];
    var providers = ctx.chimeraBrokerProviderSnapshot.data.providers;
    for (var i = 0; i < providers.length; i++) {
      var row = providers[i] || {};
      if (String(row.id || "").toLowerCase() !== pid) continue;
      var mids = Array.isArray(row.model_ids) ? row.model_ids : [];
      var seen = {};
      var out = [];
      for (var j = 0; j < mids.length; j++) {
        var mid = String(mids[j] || "").trim();
        if (!mid) continue;
        var key = mid.toLowerCase();
        if (seen[key]) continue;
        seen[key] = true;
        out.push(mid);
      }
      return out;
    }
    return [];
  }

  function adminProviderUsageRows(providerId) {
    var out = {};
    var listedModels = adminProviderCatalogModels(providerId);
    for (var li = 0; li < listedModels.length; li++) {
      var listed = String(listedModels[li] || "").trim();
      if (!listed) continue;
      out[listed] = { model_id: listed, calls: 0, errors: 0 };
    }
    var data = ctx.metricsCache || {};
    var rows = Array.isArray(data.day_rollups) && data.day_rollups.length
      ? data.day_rollups
      : (Array.isArray(data.minute_rollups) ? data.minute_rollups : []);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var mid = String(r.model_id || "");
      var pm = adminExtractProviderModel(mid);
      var provider = String(r.provider || pm.provider || "").toLowerCase();
      if (!provider || provider !== String(providerId).toLowerCase()) continue;
      var key = mid || provider + "/(unknown)";
      if (!out[key]) out[key] = { model_id: key, calls: 0, errors: 0 };
      out[key].calls += Number(r.calls) || 0;
      var status = Number(r.status);
      if (!isNaN(status) && (status < 200 || status >= 300)) out[key].errors += Number(r.calls) || 0;
    }
    var list = [];
    for (var k in out) {
      if (Object.prototype.hasOwnProperty.call(out, k)) list.push(out[k]);
    }
    list.sort(function (a, b) {
      var dc = (b.calls || 0) - (a.calls || 0);
      if (dc !== 0) return dc;
      var de = (b.errors || 0) - (a.errors || 0);
      if (de !== 0) return de;
      return String(a.model_id || "").localeCompare(String(b.model_id || ""));
    });
    return list;
  }

  function adminModelUsageById() {
    var out = {};
    var data = ctx.metricsCache || {};
    var rows = Array.isArray(data.day_rollups) && data.day_rollups.length
      ? data.day_rollups
      : (Array.isArray(data.minute_rollups) ? data.minute_rollups : []);
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var mid = String(r.model_id || "").trim();
      if (!mid) continue;
      out[mid] = (out[mid] || 0) + (Number(r.calls) || 0);
    }
    return out;
  }

  function adminProviderTierSpan(provider) {
    var p = String(provider || "").toLowerCase();
    var tier = "sum-conv-tier--inferred";
    var label = provider || "";
    if (p === "groq") {
      tier = "sum-conv-tier--request_id";
      label = "Groq";
    } else if (p === "gemini") {
      tier = "sum-conv-tier--ingest";
      label = "Gemini";
    } else if (p === "ollama") {
      tier = "sum-conv-tier--anchored_inferred";
      label = "Ollama";
    }
    return '<span class="sum-conv-tier ' + tier + '">' + escapeHtml(label) + "</span>";
  }

  function adminScopedEventsForPrincipal(principalId, maxN) {
    var want = String(principalId || "").trim();
    var out = [];
    for (var i = entryCache.length - 1; i >= 0; i--) {
      var ev = entryCache[i];
      var f = getFlat(ev.parsed);
      if (adminPrincipalForFlat(f) !== want) continue;
      out.push(ev);
      if (out.length >= maxN) break;
    }
    return out;
  }

  function adminUserStatsByPrincipal() {
    var map = {};
    for (var i = 0; i < entryCache.length; i++) {
      var ev = entryCache[i];
      var f = getFlat(ev.parsed);
      var pid = adminPrincipalForFlat(f);
      if (!pid) continue;
      if (!map[pid]) map[pid] = { conv: {}, ws: {} };
      var cid = f.conversation_id != null ? String(f.conversation_id).trim() : "";
      if (cid) map[pid].conv[cid] = true;
      var proj = String(
        f.scope_project_id != null ? f.scope_project_id
          : f.project_id != null ? f.project_id
          : f.ingest_project != null ? f.ingest_project
          : ""
      ).trim();
      if (proj) map[pid].ws[proj] = true;
    }
    return map;
  }

  function adminScopedEvlogPanelFromEvents(title, scopeId, evs) {
    var parts = [];
    var warnN = 0;
    var failN = 0;
    for (var i = 0; i < evs.length; i++) {
      var ev = evs[i];
      var flat = getFlat(ev.parsed);
      var http = sumEvlogHttpCode(ev.parsed, flat);
      var lvl = String(ev.parsed.levelCanon || ev.parsed.levelLabel || "").trim();
      if (sumEvlogIsWarnish(lvl, http)) warnN++;
      if (sumEvlogIsFailish(lvl, http)) failN++;
      parts.push(sumEvlogRowTrHtml(ev, scopeId, i, inferServiceBadge(ev), {}));
    }
    return sumEvlogPanelHtml({
      title: title,
      scrollTbodyId: "sum-evlog-" + escapeHtml(scopeId),
      warnN: warnN,
      failN: failN,
      tbodyInnerHtml: parts.join("")
    });
  }

  function adminBuildUserCardHtml(principalId, tokensForUser, stats) {
    var label = ctx.tokenLabelByTenant[principalId] || (tokensForUser[0] && tokensForUser[0].label) || principalId;
    var initials = avatarInitials(label);
    var convN = 0;
    var wsN = 0;
    if (stats) {
      for (var ck in stats.conv) if (Object.prototype.hasOwnProperty.call(stats.conv, ck)) convN++;
      for (var wk in stats.ws) if (Object.prototype.hasOwnProperty.call(stats.ws, wk)) wsN++;
    }
    var revokeIndex = tokensForUser[0] && tokensForUser[0].index != null ? String(tokensForUser[0].index) : "";
    var tokenRows = "";
    for (var i = 0; i < tokensForUser.length; i++) {
      var tr = tokensForUser[i] || {};
      tokenRows +=
        '<li><code class="sum-mono-id">' + escapeHtml(String(tr.label || "(no label)")) + '</code> · tenant ' +
        escapeHtml(String(tr.tenant_id || principalId)) + "</li>";
    }
    if (!tokenRows) tokenRows = '<li class="muted">No gateway tokens yet.</li>';
    var tokenRaw = "";
    if (tokensForUser[0] && tokensForUser[0].token != null && String(tokensForUser[0].token).trim() !== "") {
      tokenRaw = String(tokensForUser[0].token).trim();
    } else if (ctx.adminCreatedTokenByTenant[principalId]) {
      tokenRaw = String(ctx.adminCreatedTokenByTenant[principalId] || "").trim();
    }
    var createdTokenHint = tokenRaw ? ("****************************" + tokenRaw.slice(-4)) : "****************************";
    var createdTokenCopyBtn = tokenRaw
      ? '<button type="button" class="sg-op-token-copy-btn" data-admin-action="user-token-copy" data-token="' + escapeHtml(tokenRaw) + '" title="Copy API key" aria-label="Copy API key">' +
        '<svg class="sum-evlog__copy-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg></button>'
      : "";
    var scoped = adminScopedEventsForPrincipal(principalId, 18);
    return (
      '<details class="sum-card sg-op-user-card" id="admin-user-' + strHash("admin-user-" + principalId) + '" data-sg-op-user-id="' + escapeHtml(principalId) + '">' +
      "<summary>" +
      '<span class="sum-avatar sum-av-b" title="User">' + escapeHtml(initials) + '</span>' +
      '<span class="sum-main"><span class="sum-title">' + escapeHtml(label) + '</span>' +
      '<span class="sum-sub sum-sub--clamp">' + escapeHtml(principalId) + "</span></span>" +
      '<button type="button" class="sg-op-btn sg-op-btn--small sg-op-btn--danger sg-op-user-revoke-btn" data-admin-action="token-delete" data-index="' + escapeHtml(revokeIndex) + '" disabled aria-disabled="true" title="Revocation is temporarily disabled">Revoke</button>' +
      '<span class="sum-chev"></span></summary>' +
      '<div class="sum-body">' +
      '<dl class="indexer-run-kv indexer-run-kv--gateway-summary">' +
      "<dt>User id</dt><dd><code class=\"sum-mono-id\">" + escapeHtml(principalId) + "</code></dd>" +
      "<dt>Conversations</dt><dd>" + escapeHtml(formatInt(convN)) + "</dd>" +
      "<dt>Workspaces</dt><dd>" + escapeHtml(formatInt(wsN)) + "</dd></dl>" +
      '<div class="sum-section-label">Gateway tokens</div><ul class="sg-op-key-list">' + tokenRows + "</ul>" +
      '<div class="sum-section-label">Gateway API key</div><div class="sg-op-token-row"><code class="sum-mono-id">' + escapeHtml(createdTokenHint) + "</code>" + createdTokenCopyBtn + "</div>" +
      adminScopedEvlogPanelFromEvents("Scoped log — user", "user-" + principalId, scoped) +
      "</div></details>"
    );
  }

  function buildAdminUserDraftCardHtml(draft) {
    var nm = draft && draft.name ? String(draft.name) : "";
    var em = draft && draft.email ? String(draft.email) : "";
    var msg = draft && draft.msg ? String(draft.msg) : "";
    return (
      '<article class="sum-card sum-card--workspace-draft" data-admin-user-draft="' + escapeHtml(draft.id) + '">' +
      '<header class="sum-card__workspace-draft-hdr">' +
      '<span class="sum-avatar sum-av-a">+</span>' +
      '<span class="sum-main sum-main--workspace-draft"><span class="sum-title">New user</span>' +
      '<span class="sum-sub sum-sub--clamp muted">Create a gateway token and save this principal.</span></span>' +
      '<span class="ws-draft-actions"><button type="button" class="ws-draft-btn ws-draft-btn-cancel" data-admin-action="user-draft-cancel" data-draft-id="' + escapeHtml(draft.id) + '">Cancel</button>' +
      '<button type="button" class="ws-draft-btn ws-draft-btn-save" data-admin-action="user-draft-save" data-draft-id="' + escapeHtml(draft.id) + '"' + (draft.saving ? " disabled" : "") + ">Save</button></span>" +
      "</header>" +
      '<div class="sum-body"><div class="ws-draft-fields">' +
      '<div class="ws-draft-field"><label class="ws-draft-field-label">Display name</label>' +
      '<input class="ws-draft-input" data-admin-user-field="name" data-draft-id="' + escapeHtml(draft.id) + '" type="text" value="' + escapeHtml(nm) + '" placeholder="e.g. Operations" /></div>' +
      '<div class="ws-draft-field"><label class="ws-draft-field-label">Identifier / email</label>' +
      '<input class="ws-draft-input" data-admin-user-field="email" data-draft-id="' + escapeHtml(draft.id) + '" type="text" value="' + escapeHtml(em) + '" placeholder="ops@example.com" /></div>' +
      "</div>" +
      (msg ? '<p class="muted ws-draft-hint">' + escapeHtml(msg) + "</p>" : "") +
      "</div></article>"
    );
  }

  function buildAdminUsersCardHtml() {
    var toks = ctx.tokenListCache || [];
    var byPrincipal = {};
    for (var i = 0; i < toks.length; i++) {
      var row = toks[i] || {};
      var pid = String(row.tenant_id || "").trim();
      if (!pid) continue;
      if (!byPrincipal[pid]) byPrincipal[pid] = [];
      byPrincipal[pid].push(row);
    }
    var userStats = adminUserStatsByPrincipal();
    var draftHtml = "";
    for (var d = 0; d < ctx.adminUserDrafts.length; d++) draftHtml += buildAdminUserDraftCardHtml(ctx.adminUserDrafts[d]);
    var usersHtml = "";
    var pids = Object.keys(byPrincipal);
    pids.sort();
    for (var p = 0; p < pids.length; p++) {
      var pid2 = pids[p];
      usersHtml += adminBuildUserCardHtml(pid2, byPrincipal[pid2], userStats[pid2] || null);
    }
    if (!usersHtml) usersHtml = '<p class="muted">No users yet. Add one to create a gateway token.</p>';
    return (
      '<div class="sum-feed-section" id="admin-users">' +
      '<div class="sum-feed-section-head">' +
      '<span class="sum-feed-section-title sum-section-label">Users</span>' +
      '<button type="button" class="sum-workspaces-create-btn" data-admin-action="user-add">Add user</button></div>' +
      '<div class="sum-workspaces-intro"><p class="sum-workspaces-intro-lead">Onboard principals as first-class users with gateway tokens, conversation/workspace counts, and a scoped activity stream.</p></div>' +
      '<div class="sg-op-user-drafts-stack">' + draftHtml + "</div>" +
      '<div class="sg-op-user-cards-stack">' + usersHtml + "</div></div>"
    );
  }

  function buildAdminProviderCardHtml(providerId, title, avatar, subtitle) {
    var st = ctx.adminStateCache || {};
    var p = st.providers || {};
    var row = p[providerId] || {};
    var keys = row && Array.isArray(row.keys) ? row.keys : [];
    var keyCount = keys.length;
    var modelCount = adminProviderModelCount(providerId);
    var isOllama = providerId === "ollama";
    var metrics = "";
    if (isOllama) {
      metrics = '<span class="sum-metrics"><span class="chip">models ' + escapeHtml(formatInt(modelCount)) + "</span></span>";
    } else {
      metrics =
        '<span class="sum-metrics"><span class="chip">keys ' +
        escapeHtml(formatInt(keyCount)) +
        '</span><span class="chip">models ' +
        escapeHtml(formatInt(modelCount)) +
        "</span></span>";
    }
    var availability = adminProviderAvailabilityHtml(providerId, !!row.ok);
    var usageRows = adminProviderUsageRows(providerId);
    var providerIntro = adminProviderIntro(providerId, subtitle);
    var usageHtml = "";
    if (!usageRows.length) {
      usageHtml = '<p class="muted">No usage yet in loaded metrics window.</p>';
    } else {
      usageHtml = '<div class="sum-metrics-table-wrap"><table class="sum-metrics-table"><thead><tr><th>Model</th><th class="num">Requests</th><th class="num">Errors</th></tr></thead><tbody>';
      for (var ui = 0; ui < usageRows.length; ui++) {
        var ur = usageRows[ui];
        usageHtml += '<tr><td><code class="sum-mono-id">' + escapeHtml(ur.model_id) + '</code></td><td class="num">' + escapeHtml(formatInt(ur.calls)) + '</td><td class="num">' + escapeHtml(formatInt(ur.errors)) + "</td></tr>";
      }
      usageHtml += "</tbody></table></div>";
    }
    var body = "";
    if (isOllama) {
      body =
        providerIntro +
        '<div class="sum-section-label">Model usage (24h)</div>' + usageHtml +
        '<div class="sg-op-provider-edit-row"><div class="sg-op-provider-edit-main"><label class="sg-op-label">Server base URL</label>' +
        '<input id="admin-ollama-url" class="sg-op-input" type="url" placeholder="http://127.0.0.1:11434" value="' + escapeHtml(row.ollama_base_url || "") + '"/></div>' +
        '<button class="sum-workspaces-create-btn sg-op-save-btn" type="button" data-admin-action="ollama-save">Save</button></div>';
    } else {
      body =
        providerIntro +
        '<div class="sum-section-label">Model usage (24h)</div>' + usageHtml +
        '<div class="sum-section-label">API KEYS</div>' +
        '<ul class="sg-op-key-list">' + providerRowsHtml(providerId, row) + "</ul>" +
        '<div class="sg-op-provider-edit-row"><div class="sg-op-provider-edit-main">' +
        '<input id="admin-' + escapeHtml(providerId) + '-key" class="sg-op-input" type="password" placeholder="' + (providerId === "groq" ? "gsk-…" : "AIza…") + '"/></div>' +
        '<button class="sum-workspaces-create-btn sg-op-save-btn" type="button" data-admin-action="provider-key-add" data-provider="' + escapeHtml(providerId) + '">Save</button></div>';
    }
    var scoped = [];
    for (var ei = entryCache.length - 1; ei >= 0 && scoped.length < 18; ei--) {
      var ev = entryCache[ei];
      var fEv = getFlat(ev.parsed);
      var msgEv = String(fEv.msg || fEv.message || "").toLowerCase();
      var providerHit =
        String(fEv.provider_id || fEv.provider || fEv.upstream_provider || "").toLowerCase() === String(providerId).toLowerCase() ||
        String(fEv.upstreamModel || fEv.model || "").toLowerCase().indexOf(String(providerId).toLowerCase() + "/") === 0 ||
        msgEv.indexOf(String(providerId).toLowerCase()) >= 0;
      if (providerHit) scoped.push(ev);
    }
    var avatarClass = adminProviderAvatarClass(providerId);
    return (
      '<details class="sum-card" id="admin-provider-' + escapeHtml(providerId) + '">' +
      '<summary><span class="sum-avatar ' + escapeHtml(avatarClass) + '">' + escapeHtml(avatar) + '</span><span class="sum-main"><span class="sum-title">' + escapeHtml(title) + "</span>" +
      '<span class="sum-sub sum-sub--clamp">' + escapeHtml(subtitle) + "</span></span>" +
      metrics +
      availability +
      '<span class="sum-chev"></span></summary><div class="sum-body">' + body +
      adminScopedEvlogPanelFromEvents("Scoped log — " + title, "provider-" + providerId, scoped) +
      "</div></details>"
    );
  }

  function buildAdminRoutingRulesCardHtml() {
    var gw = (ctx.adminStateCache && ctx.adminStateCache.gateway) || {};
    var policy = gw.routing_policy_yaml || "";
    var policyLive = ctx.routingPolicyDraft != null ? String(ctx.routingPolicyDraft) : String(policy);
    var policyDirty = String(policyLive) !== String(policy);
    var rulesCount = countRoutingRulesFromYAML(policyLive);
    var freeTierOnly = !!gw.filter_free_tier_models;
    var usesByModel = adminModelUsageById();
    var routingRulesRows = parseRoutingRulesFromYAML(policy);
    var tableRows = "";
    for (var ri = 0; ri < routingRulesRows.length; ri++) {
      var rr = routingRulesRows[ri] || {};
      var matchVal = "";
      if (rr.whenInline) {
        matchVal = rr.whenInline === "{}" ? "(catch-all)" : rr.whenInline;
      } else if (rr.whenParts && rr.whenParts.length) {
        matchVal = rr.whenParts.join("; ");
      } else {
        matchVal = "(catch-all)";
      }
      var modelCell = "—";
      if (rr.models && rr.models.length) {
        var parts = [];
        for (var mi = 0; mi < rr.models.length; mi++) {
          parts.push('<code class="sum-mono-id">' + escapeHtml(rr.models[mi]) + "</code>");
        }
        modelCell = parts.join(", ");
      }
      var hits = 0;
      for (var hm = 0; hm < (rr.models || []).length; hm++) {
        hits += Number(usesByModel[rr.models[hm]] || 0);
      }
      tableRows +=
        "<tr>" +
        '<td><code class="sum-mono-id">' + escapeHtml(rr.name || "unnamed") + "</code></td>" +
        '<td><code class="sum-mono-id">' + escapeHtml(matchVal) + "</code></td>" +
        "<td>" + modelCell + "</td>" +
        '<td class="num">' + escapeHtml(formatInt(hits)) + "</td>" +
        "</tr>";
    }
    if (!tableRows) tableRows = '<tr><td colspan="4" class="muted">No routing rules configured.</td></tr>';
    return (
      '<details class="sum-card" id="admin-routing-rules">' +
      '<summary><span class="sum-avatar sum-av-svc-gateway">Rt</span><span class="sum-main"><span class="sum-title">Routing rules</span>' +
      '<span class="sum-sub sum-sub--clamp">Virtual model policy with editable YAML and live catalog generation.</span></span>' +
      '<span class="sum-metrics"><span class="chip">' + escapeHtml(formatInt(rulesCount)) + ' active rules</span></span>' +
      '<span class="sum-chev"></span></summary>' +
      '<div class="sum-body">' +
      '<div class="sg-op-card-note">Review active routing rules and 24h hits; use Configure to edit policy YAML.</div>' +
      '<div class="sg-op-head-row">' +
      '<div class="sum-section-label">Routing Policy</div>' +
      '<div class="sg-op-head-actions">' +
      (ctx.adminRoutingEditing
        ? ('<button class="sg-op-btn sg-op-btn--ghost sg-op-btn--toggle' + (freeTierOnly ? " is-active" : "") + '" type="button" data-admin-action="routing-free-tier-toggle" aria-pressed="' + (freeTierOnly ? "true" : "false") + '">Free Tier Only</button>' +
          '<button class="sg-op-btn sg-op-btn--ghost" type="button" data-admin-action="routing-generate">Generate from live catalog</button>' +
          '<button class="sg-op-btn sg-op-btn--ghost" type="button" data-admin-action="routing-cancel">Cancel</button>')
        : '<button class="sg-op-btn" type="button" data-admin-action="routing-configure">Configure</button>') +
      "</div>" +
      "</div>" +
      '<div id="admin-routing-table-view"' + (ctx.adminRoutingEditing ? " hidden" : "") + ">" +
      '<div class="sum-metrics-table-wrap sg-op-routing-table-scroll"><table class="sum-metrics-table"><thead><tr><th>Name</th><th>Match</th><th>Models</th><th class="num">Hits (24h)</th></tr></thead><tbody>' + tableRows + "</tbody></table></div>" +
      "</div>" +
      '<div id="admin-routing-yaml-view"' + (ctx.adminRoutingEditing ? "" : " hidden") + ">" +
      '<div id="admin-routing-policy-wrap" class="sg-op-yaml-wrap sg-op-yaml-wrap--full' + (policyDirty ? " sg-op-yaml-wrap--dirty" : "") + '">' +
      '<textarea id="admin-routing-yaml" class="sg-op-yaml-textarea" rows="10" spellcheck="false">' + escapeHtml(policyLive) + "</textarea>" +
      '<div class="sg-op-yaml-ov">' +
      '<button type="button" class="sg-op-yaml-ov-btn" data-admin-action="routing-policy-refresh" title="Revert to last saved routing YAML" aria-label="Revert routing policy"><span class="sg-op-reload-icon" aria-hidden="true"></span></button>' +
      '<button type="button" class="sg-op-yaml-ov-btn sg-op-yaml-ov-btn--save sg-op-yaml-ov-save" data-admin-action="routing-policy-save">Save</button>' +
      "</div></div></div>" +
      adminScopedEvlogPanelFromEvents("Scoped log — routing decisions", "routing-rules", adminScopedEventsForRouting("rules")) +
      "</div></details>"
    );
  }

  function buildAdminFallbackCardHtml() {
    var gw = (ctx.adminStateCache && ctx.adminStateCache.gateway) || {};
    var fallback = Array.isArray(gw.fallback_chain) ? gw.fallback_chain : [];
    var freeTierOnly = !!gw.filter_free_tier_models;
    var fallbackYAML = ctx.fallbackTouched ? ((document.getElementById("admin-fallback-yaml") && document.getElementById("admin-fallback-yaml").value) || fallbackChainToYAML(fallback)) : fallbackChainToYAML(fallback);
    var chain = fallback;
    if (ctx.fallbackTouched) {
      try {
        chain = parseFallbackChainInput(fallbackYAML);
      } catch (_eFbParse) {
        chain = fallback;
      }
    }
    var usesByModel = adminModelUsageById();
    var tableRows = "";
    for (var i = 0; i < chain.length; i++) {
      var mid = String(chain[i] || "");
      var pm = adminExtractProviderModel(mid);
      tableRows +=
        "<tr>" +
        '<td class="num">' + escapeHtml(String(i + 1)) + "</td>" +
        "<td>" + adminProviderTierSpan(pm.provider) + "</td>" +
        '<td><code class="sum-mono-id">' + escapeHtml(mid) + "</code></td>" +
        '<td class="num">' + escapeHtml(formatInt(usesByModel[mid] || 0)) + "</td>" +
        "</tr>";
    }
    if (!tableRows) tableRows = '<tr><td colspan="4" class="muted">No fallback routes configured.</td></tr>';
    return (
      '<details class="sum-card" id="admin-fallback-chain">' +
      '<summary><span class="sum-avatar sum-av-svc-gateway">Fb</span><span class="sum-main"><span class="sum-title">Fallback chain</span>' +
      '<span class="sum-sub sum-sub--clamp">Ordered failover list used when the first route cannot serve.</span></span>' +
      '<span class="sum-metrics"><span class="chip">' + escapeHtml(formatInt(fallback.length)) + ' tiers</span></span>' +
      '<span class="sum-chev"></span></summary>' +
      '<div class="sum-body">' +
      '<div class="sg-op-card-note">Define the fallback sequence used when the selected route cannot serve a request.</div>' +
      '<div class="sg-op-head-row">' +
      '<div class="sum-section-label">Fallback Order</div>' +
      '<div class="sg-op-head-actions">' +
      (ctx.adminFallbackEditing
        ? ('<button class="sg-op-btn sg-op-btn--ghost sg-op-btn--toggle' + (freeTierOnly ? " is-active" : "") + '" type="button" data-admin-action="routing-free-tier-toggle" aria-pressed="' + (freeTierOnly ? "true" : "false") + '">Free Tier Only</button>' +
          '<button class="sg-op-btn sg-op-btn--ghost" type="button" data-admin-action="routing-generate">Generate from live catalog</button>' +
          '<button class="sg-op-btn sg-op-btn--ghost" type="button" data-admin-action="fallback-cancel">Cancel</button>')
        : '<button class="sg-op-btn" type="button" data-admin-action="fallback-configure">Configure</button>') +
      "</div></div>" +
      '<div id="admin-fallback-table-view"' + (ctx.adminFallbackEditing ? " hidden" : "") + ">" +
      '<div class="sum-metrics-table-wrap sg-op-fallback-table-scroll"><table class="sum-metrics-table sg-op-fallback-table"><thead><tr><th class="num">Order</th><th>Provider</th><th>Model</th><th class="num">Uses (24h)</th></tr></thead><tbody>' + tableRows + "</tbody></table></div>" +
      "</div>" +
      '<div id="admin-fallback-yaml-view"' + (ctx.adminFallbackEditing ? "" : " hidden") + ">" +
      '<div id="admin-fallback-yaml-wrap" class="sg-op-yaml-wrap sg-op-yaml-wrap--full' + (ctx.fallbackTouched ? " sg-op-yaml-wrap--dirty" : "") + '">' +
      '<textarea id="admin-fallback-yaml" class="sg-op-yaml-textarea" rows="8" spellcheck="false">' + escapeHtml(fallbackYAML) + "</textarea>" +
      '<div class="sg-op-yaml-ov"><button type="button" class="sg-op-yaml-ov-btn" data-admin-action="fallback-refresh" title="Revert fallback chain" aria-label="Revert fallback chain"><span class="sg-op-reload-icon" aria-hidden="true"></span></button>' +
      '<button type="button" class="sg-op-yaml-ov-btn sg-op-yaml-ov-btn--save sg-op-yaml-ov-save" data-admin-action="fallback-save">Save</button></div></div>' +
      "</div>" +
      adminScopedEvlogPanelFromEvents("Scoped log — fallback / failover", "routing-fallback", adminScopedEventsForRouting("fallback")) +
      "</div></details>"
    );
  }

  function buildAdminRouterModelCardHtml() {
    var gw = (ctx.adminStateCache && ctx.adminStateCache.gateway) || {};
    var routerModels = Array.isArray(gw.router_models) ? gw.router_models : [];
    var freeTierOnly = !!gw.filter_free_tier_models;
    var thresholdSaved = String(gw.tool_router_confidence_threshold != null ? gw.tool_router_confidence_threshold : 0.5);
    var threshold = ctx.routerThresholdTouched && ctx.routerThresholdDraft != null ? String(ctx.routerThresholdDraft) : thresholdSaved;
    var routerEnabled = ctx.routerEnabledTouched && ctx.routerEnabledDraft != null ? !!ctx.routerEnabledDraft : !!gw.tool_router_enabled;
    var routerModelsYAML = ctx.routerModelsTouched
      ? String(ctx.routerModelsDraft != null ? ctx.routerModelsDraft : ((document.getElementById("admin-router-models-yaml") && document.getElementById("admin-router-models-yaml").value) || fallbackChainToYAML(routerModels)))
      : fallbackChainToYAML(routerModels);
    var routerChain = routerModels;
    if (ctx.routerModelsTouched) {
      try {
        routerChain = parseFallbackChainInput(routerModelsYAML);
      } catch (_eRouterParse) {
        routerChain = routerModels;
      }
    }
    var usesByModel = adminModelUsageById();
    var routerTableRows = "";
    for (var i = 0; i < routerChain.length; i++) {
      var rid = String(routerChain[i] || "");
      var rpm = adminExtractProviderModel(rid);
      routerTableRows +=
        "<tr>" +
        '<td class="num">' + escapeHtml(String(i + 1)) + "</td>" +
        "<td>" + adminProviderTierSpan(rpm.provider) + "</td>" +
        '<td><code class="sum-mono-id">' + escapeHtml(rid) + "</code></td>" +
        '<td class="num">' + escapeHtml(formatInt(usesByModel[rid] || 0)) + "</td>" +
        "</tr>";
    }
    if (!routerTableRows) routerTableRows = '<tr><td colspan="4" class="muted">No router models configured.</td></tr>';
    return (
      '<details class="sum-card" id="admin-router-model">' +
      '<summary><span class="sum-avatar sum-av-svc-gateway">Tr</span><span class="sum-main"><span class="sum-title">Router model</span>' +
      '<span class="sum-sub sum-sub--clamp">Tool-router controls and ordered router model list.</span></span>' +
      '<button class="sum-router-toggle" type="button" id="admin-router-enabled" data-admin-action="router-enabled-toggle" aria-label="Toggle tool router" aria-pressed="' + (routerEnabled ? "true" : "false") + '">' +
      '<span class="sum-router-toggle__track"><span class="sum-router-toggle__thumb"></span></span>' +
      "</button>" +
      '<span class="sum-chev"></span></summary>' +
      '<div class="sum-body">' +
      '<div class="sg-op-head-row">' +
      '<div class="sg-op-card-note sg-op-card-note--tight">Manage tool-router model order, enabled state, and confidence threshold from one panel.</div>' +
      "</div>" +
      '<div class="sg-op-head-row">' +
      '<div class="sum-section-label">Router Models</div>' +
      '<div class="sg-op-head-actions">' +
      (ctx.adminRouterEditing
        ? ('<button class="sg-op-btn sg-op-btn--ghost sg-op-btn--toggle' + (freeTierOnly ? " is-active" : "") + '" type="button" data-admin-action="routing-free-tier-toggle" aria-pressed="' + (freeTierOnly ? "true" : "false") + '">Free Tier Only</button>' +
          '<button class="sg-op-btn sg-op-btn--ghost" type="button" data-admin-action="routing-generate">Generate from live catalog</button>' +
          '<button class="sg-op-btn sg-op-btn--ghost" type="button" data-admin-action="router-cancel">Cancel</button>')
        : '<button class="sg-op-btn" type="button" data-admin-action="router-configure">Configure</button>') +
      "</div></div>" +
      '<div id="admin-router-table-view"' + (ctx.adminRouterEditing ? " hidden" : "") + ">" +
      '<div class="sum-metrics-table-wrap sg-op-router-table-scroll"><table class="sum-metrics-table sg-op-router-table"><thead><tr><th class="num">Order</th><th>Provider</th><th>Model</th><th class="num">Uses (24h)</th></tr></thead><tbody>' + routerTableRows + "</tbody></table></div>" +
      "</div>" +
      '<div id="admin-router-yaml-view"' + (ctx.adminRouterEditing ? "" : " hidden") + ">" +
      '<div id="admin-router-models-wrap" class="sg-op-yaml-wrap sg-op-yaml-wrap--full' + (ctx.routerModelsTouched ? " sg-op-yaml-wrap--dirty" : "") + '">' +
      '<textarea id="admin-router-models-yaml" class="sg-op-yaml-textarea" rows="8" spellcheck="false">' + escapeHtml(routerModelsYAML) + "</textarea>" +
      '<div class="sg-op-yaml-ov"><button type="button" class="sg-op-yaml-ov-btn" data-admin-action="router-models-refresh" title="Revert router models" aria-label="Revert router models"><span class="sg-op-reload-icon" aria-hidden="true"></span></button>' +
      '<button type="button" class="sg-op-yaml-ov-btn sg-op-yaml-ov-btn--save sg-op-yaml-ov-save" data-admin-action="router-save">Save</button></div></div>' +
      "</div>" +
      '<div class="sg-op-head-row">' +
      '<label class="sg-op-label sg-op-label--inline" for="admin-router-threshold">Confidence threshold</label>' +
      '<div class="sg-op-head-actions">' +
      '<input id="admin-router-threshold" class="sg-op-input" type="number" min="0" max="1" step="0.05" value="' + escapeHtml(threshold) + '" style="max-width:9rem"/>' +
      '<button type="button" class="sg-op-yaml-ov-btn sg-op-yaml-ov-btn--save" data-admin-action="router-save">Save</button>' +
      "</div></div>" +
      adminScopedEvlogPanelFromEvents("Scoped log — tool-router", "routing-router", adminScopedEventsForRouting("router")) +
      "</div></details>"
    );
  }

  function adminScopedEventsForRouting(kind) {
    var out = [];
    var want = String(kind || "").toLowerCase();
    for (var i = entryCache.length - 1; i >= 0 && out.length < 18; i--) {
      var ev = entryCache[i];
      var f = getFlat(ev.parsed);
      var msg = String(f.msg || f.message || "").toLowerCase();
      var hit = false;
      if (want === "rules") {
        hit = msg.indexOf("routing") >= 0 || msg.indexOf("virtual model") >= 0;
      } else if (want === "fallback") {
        hit = msg.indexOf("fallback") >= 0 || msg.indexOf("failover") >= 0;
      } else if (want === "router") {
        hit = msg.indexOf("router") >= 0 || msg.indexOf("tool_router") >= 0 || msg.indexOf("tool-router") >= 0;
      }
      if (hit) out.push(ev);
    }
    return out;
  }

  function buildAdminWorkflowsFeedSection() {
    return (
      '<div class="sum-feed-section">' +
      buildAdminUsersCardHtml() +
      '<div class="sum-section-label sum-feed-section-title">Providers</div>' +
      '<div class="sum-workspaces-intro"><p class="sum-workspaces-intro-lead">Providers drive upstream inference through chimera-broker; each card shows configuration, usage, and scoped log activity.</p></div>' +
      buildAdminProviderCardHtml("groq", "Groq", "Gq", "LPU inference provider with key management.") +
      buildAdminProviderCardHtml("gemini", "Gemini", "Gm", "Google Gemini provider with key management.") +
      buildAdminProviderCardHtml("ollama", "Ollama", "Ol", "Local/remote Ollama endpoint for chat and embeddings.") +
      '<div class="sum-section-label sum-feed-section-title">Routing</div>' +
      '<div class="sum-workspaces-intro"><p class="sum-workspaces-intro-lead">Routing controls are fully editable here: policy YAML, fallback chain, and tool-router settings.</p></div>' +
      buildAdminRoutingRulesCardHtml() +
      buildAdminFallbackCardHtml() +
      buildAdminRouterModelCardHtml() +
      "</div>"
    );
  }

  function buildGatewayUsageCardHtml() {
    var data = ctx.metricsCache;
    var m =
      globalThis.ChimeraLogs &&
        globalThis.ChimeraLogs.Derive &&
        globalThis.ChimeraLogs.Derive.gatewayUsageCardModel
        ? globalThis.ChimeraLogs.Derive.gatewayUsageCardModel(
          data,
          function (rows) { return aggregateRollupRows(rows); },
          function (id) { return chimeraBrokerShortModelLabel(id); }
        )
        : null;

    var loading = m ? !!m.loading : !data;
    var storeOpen = m ? !!m.storeOpen : !!(data && data.metrics_store_open);
    var lastModel = m ? m.lastModelId || "—" : "—";
    var minAgg = m ? m.minAgg || { models: 0, tokens: 0 } : { models: 0, tokens: 0 };
    var dayAgg = m ? m.dayAgg || { models: 0, tokens: 0 } : { models: 0, tokens: 0 };
    var lblMin = m ? m.lblMin || "" : "";
    var lblDay = m ? m.lblDay || "" : "";
    var lblMinFmt = lblMin ? formatUtcToMinute(lblMin) : "";
    var lblDayFmt = lblDay ? formatUtcToDay(lblDay) : "";

    var sub = loading
      ? '<span class="sum-sub sum-sub--clamp muted">Loading gateway metrics…</span>'
      : '<span class="sum-sub sum-sub--clamp">Last model <code class="sum-mono-id">' +
      escapeHtml(chimeraBrokerShortModelLabel(lastModel)) +
      "</code></span>";

    var minTail = loading ? "…" : formatInt(minAgg.models) + " models · " + formatCompactTok(minAgg.tokens) + " tokens";
    var dayTail = loading ? "…" : formatInt(dayAgg.models) + " models · " + formatCompactTok(dayAgg.tokens) + " tokens";
    var minPillHtml = "<strong>minute</strong> · " + escapeHtml(minTail);
    var dayPillHtml = "<strong>day</strong> · " + escapeHtml(dayTail);

    var metrics =
      '<span class="sum-metrics">' +
      '<span class="sum-metric" title="Distinct upstream models · summed est. tokens (UTC minute rollup)">' +
      minPillHtml +
      '</span><span class="sum-metric" title="Distinct upstream models · summed est. tokens (UTC calendar day rollup)">' +
      dayPillHtml +
      "</span></span>";

    var introHtml = buildGatewayUsageIntroHtml();

    var expandedInner = "";
    if (loading) {
      expandedInner = introHtml + '<p class="muted">Fetching /api/ui/metrics…</p>';
    } else if (!storeOpen) {
      expandedInner =
        introHtml +
        '<p class="muted">' +
        escapeHtml((m && m.message) || (data && data.message) || "Metrics store is not available.") +
        "</p>";
    } else {
      expandedInner = introHtml;
      expandedInner +=
        '<div class="sum-section-label">CURRENT MINUTE · ' +
        escapeHtml(lblMinFmt || lblMin) +
        "</div>" +
        metricsRollupTableHtml(data.minute_rollups || []) +
        '<div class="sum-section-label">CURRENT DAY · ' +
        escapeHtml(lblDayFmt || lblDay) +
        "</div>" +
        metricsRollupTableHtml(data.day_rollups || []) +
        '<div class="sum-section-label">Recent upstream calls</div>' +
        metricsEventsTableHtml(data.recent_events || []);
    }

    return (
      '<details class="sum-card" id="gw-usage-metrics">' +
      "<summary>" +
      '<span class="sum-avatar sum-av-svc-gateway">GW</span>' +
      '<span class="sum-main"><span class="sum-title">Model usage metrics</span>' +
      sub +
      "</span>" +
      metrics +
      '<span class="sum-chev"></span></summary>' +
      '<div class="sum-body">' +
      expandedInner +
      "</div></details>"
    );
  }

  function fetchTokenLabels() {
    fetch("/api/ui/tokens", { credentials: "same-origin" })
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.tokens)) return;
        ctx.tokenLabelByTenant = {};
        for (var i = 0; i < data.tokens.length; i++) {
          var row = data.tokens[i];
          var tid =
            row.tenant_id != null && String(row.tenant_id).trim() !== ""
              ? String(row.tenant_id).trim()
              : "";
          if (!tid) continue;
          var tok = row.token != null && String(row.token).trim() !== "" ? String(row.token).trim() : "";
          if (tok) ctx.adminCreatedTokenByTenant[tid] = tok;
          var lb =
            row.label != null && String(row.label).trim() !== ""
              ? String(row.label).trim()
              : "";
          ctx.tokenLabelByTenant[tid] = lb || tid;
        }
        if (getViewMode() === "summarized") scheduleStoryRebuild();
      })
      .catch(function () { });
  }

  /** Conversation card title: "label (tenant_id) - uuid" using token label when known. */
  function formatConversationCardTitle(tenantId, convId) {
    var tid = String(tenantId || "").trim();
    if (!tid) tid = "(unknown principal)";
    var lab = ctx.tokenLabelByTenant[tid];
    var head;
    if (lab && lab !== tid)
      head = escapeHtml(lab) + " (" + escapeHtml(tid) + ")";
    else
      head = escapeHtml(tid);
    var c = String(convId || "");
    var cshow = c.length > 48 ? c.slice(0, 48) + "…" : c;
    return (
      head +
      ' <span style="opacity:.55">-</span> <code class="sum-mono-id" style="font-size:0.85em">' +
      escapeHtml(cshow) +
      "</code>"
    );
  }

  function avatarInitials(label) {
    var s = String(label || "?").trim();
    if (!s) return "??";
    var parts = s.split(/[^a-zA-Z0-9]+/).filter(Boolean);
    if (parts.length >= 2)
      return (String(parts[0][0] || "") + String(parts[1][0] || ""))
        .toUpperCase()
        .slice(0, 2);
    var t = s.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return t.slice(0, 2) || "??";
  }

  function avatarHueClass(seed) {
    var h = strHash(String(seed || ""));
    var n = parseInt(String(h).replace(/[^\d]/g, "0"), 10) || 0;
    var classes = ["sum-av-a", "sum-av-b", "sum-av-c", "sum-av-d", "sum-av-e", "sum-av-f"];
    return classes[n % classes.length];
  }

  function inferServiceBadge(ev) {
    var src = (ev.source || (ev.parsed && ev.parsed.app) || "").toLowerCase();
    var f = getFlat(ev.parsed);
    var sh = (ev.parsed && ev.parsed.shape) || "";
    if (src === "chimera-vectorstore" || sh === "service.chimera-vectorstore" || f.service === "chimera-vectorstore")
      return { cls: "sum-svc-vectorstore", lab: "chimera-vectorstore" };
    if (src === "chimera-indexer" || sh.indexOf("chimera-indexer") === 0 || f.service === "chimera-indexer")
      return { cls: "sum-svc-indexer", lab: "chimera-indexer" };
    if (src === "chimera-broker" || sh.indexOf("chimera-broker") >= 0 || sh.indexOf("chat.chimera-broker") === 0)
      return { cls: "sum-svc-broker", lab: "chimera-broker" };
    if (sh === "http.access" || (f.method && f.path)) return { cls: "sum-svc-web", lab: "web" };
    if (sh === "chat.routing") return { cls: "sum-svc-gateway", lab: "routing" };
    if (
      src === "chimera-gateway" ||
      src === "gateway" ||
      f.service === "chimera-gateway" ||
      f.service === "gateway"
    )
      return { cls: "sum-svc-gateway", lab: "chimera-gateway" };
    return { cls: "sum-svc-gateway", lab: "chimera-gateway" };
  }

  /**
   * Timeline segment key for gateway request bar (TIMELINE_BAR_KINDS).
   * Prefers structured `timeline_kind` from gateway/RAG/ingest logs (server-emitted); falls back to inferServiceBadge.
   */
  function timelineKindLab(ev) {
    var f = getFlat(ev.parsed);
    var tk = f.timeline_kind != null ? String(f.timeline_kind).trim().toLowerCase() : "";
    if (tk === "broker") return "chimera-broker";
    if (tk === "vectorstore") return "chimera-vectorstore";
    if (tk === "indexer") return "chimera-indexer";
    if (tk === "gateway") return "chimera-gateway";
    if (tk === "web" || tk === "chimera-vectorstore" || tk === "chimera-broker" || tk === "chimera-indexer" || tk === "chimera-gateway") {
      return tk;
    }
    var lab = inferServiceBadge(ev).lab;
    if (lab === "web") return "web";
    if (lab === "chimera-vectorstore") return "chimera-vectorstore";
    if (lab === "chimera-broker") return "chimera-broker";
    if (lab === "chimera-indexer") return "chimera-indexer";
    return "chimera-gateway";
  }

  function formatTimeHm(ev) {
    var ins = entryInstant({ ts: ev.ts });
    if (!ins) return "—";
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).format(ins);
    } catch (e) {
      return ins.toTimeString().slice(0, 8);
    }
  }

  function scrapeConversationMetrics(events) {
    if (globalThis.ChimeraLogs && globalThis.ChimeraLogs.Derive && globalThis.ChimeraLogs.Derive.scrapeConversationMetrics) {
      return globalThis.ChimeraLogs.Derive.scrapeConversationMetrics(events, getFlat);
    }
    return { tok: null, vec: null };
  }

  function conversationCardModelForGroup(events) {
    if (globalThis.ChimeraLogs && ChimeraLogs.Derive && typeof ChimeraLogs.Derive.buildConversationCardModel === "function") {
      return ChimeraLogs.Derive.buildConversationCardModel(events, getFlat);
    }
    return {
      stateLabel: "—",
      stateKind: "complete",
      progress: {
        received: "pending",
        routed: "pending",
        rag: "pending",
        broker: "pending",
        delivered: "pending"
      },
      kv: { turnIndex: "", clientModel: "", upstreamModel: "", stream: "", ragCollection: "", mergeHint: "" },
      chips: { tools: 0, fallback: 0 },
      ingestRunIds: [],
      witness: { request: false, response: false }
    };
  }

  function conversationLifecycleStepDefs() {
    return [
      { k: "received", lab: "Accepted" },
      { k: "rag", lab: "Context" },
      { k: "routed", lab: "Routed" },
      { k: "broker", lab: "Broker" },
      { k: "delivered", lab: "Delivered" }
    ];
  }

  function conversationLifecycleStateClass(raw) {
    var st = String(raw || "pending").replace(/[^a-z]/gi, "");
    return st || "pending";
  }

  /**
   * Segmented lifecycle bar (5 equal segments, small gaps). opts.compact: summary row, no labels (hidden when card open via CSS).
   */
  function conversationLifecycleBarHtml(progress, opts) {
    opts = opts || {};
    var compact = !!opts.compact;
    progress = progress || {};
    var steps = conversationLifecycleStepDefs();
    var trackParts = [];
    var labelParts = [];
    var ariaBits = [];
    var si;
    for (si = 0; si < steps.length; si++) {
      var step = steps[si];
      var rawSt = progress[step.k];
      var st = conversationLifecycleStateClass(rawSt);
      var shown = String(rawSt != null && rawSt !== "" ? rawSt : "pending");
      var title = step.lab + ": " + shown;
      ariaBits.push(step.lab + " " + shown);
      trackParts.push(
        '<span class="sum-conv-lifecycle-seg sum-conv-lifecycle-seg--' +
          st +
          '" title="' +
          escapeHtml(title) +
          '"></span>'
      );
      if (!compact) {
        labelParts.push(
          '<span class="sum-conv-lifecycle-bar-label" title="' +
            escapeHtml(title) +
            '">' +
            escapeHtml(step.lab) +
            "</span>"
        );
      }
    }
    var track =
      '<div class="sum-conv-lifecycle-bar-track">' + trackParts.join("") + "</div>";
    var labels = compact ? "" : '<div class="sum-conv-lifecycle-bar-labels">' + labelParts.join("") + "</div>";
    var wrapCls = "sum-conv-lifecycle-bar" + (compact ? " sum-conv-lifecycle-bar--compact" : "");
    var aria = ' role="group" aria-label="' +
      escapeHtml(compact ? "Lifecycle: " + ariaBits.join(", ") : "Request lifecycle") +
      '"';
    return '<div class="' + wrapCls + '"' + aria + ">" + track + labels + "</div>";
  }

  function conversationCardChipsSummaryHtml(model) {
    model = model || {};
    var ch = model.chips || {};
    var parts = [];
    if ((ch.tools || 0) > 0) parts.push("Tools · " + ch.tools);
    if ((ch.fallback || 0) > 0) parts.push("Fallback · " + ch.fallback);
    if (!parts.length) return "";
    var h = '<div class="sum-conv-chip-row sum-conv-chip-row--summary">';
    for (var pi = 0; pi < parts.length; pi++) {
      h += '<span class="sum-conv-chip">' + escapeHtml(parts[pi]) + "</span>";
    }
    h += "</div>";
    return h;
  }

  function conversationCardKvHtml(model) {
    model = model || {};
    var kv = model.kv || {};
    function row(k, v) {
      if (!v || String(v).trim() === "" || String(v) === "—") return "";
      return (
        '<div class="sum-conv-kv-row"><dt>' +
        escapeHtml(k) +
        "</dt><dd>" +
        escapeHtml(String(v)) +
        "</dd></div>"
      );
    }
    var body =
      row("Turn", kv.turnIndex) +
      row("Client model", kv.clientModel) +
      row("Upstream model", kv.upstreamModel) +
      row("Stream", kv.stream) +
      row(
        "RAG collection",
        kv.ragCollection && typeof ragCollectionLabelForUi === "function"
          ? ragCollectionLabelForUi(kv.ragCollection)
          : kv.ragCollection
      ) +
      row("Merge", kv.mergeHint);
    if (!body) return "";
    return (
      '<div class="sum-conv-kv"><div class="sum-section-label">Conversation</div><dl class="sum-conv-kv-grid">' +
      body +
      "</dl></div>"
    );
  }

  function convEventDedupeKey(ent) {
    if (ent.seq != null && ent.seq !== "") return "s:" + String(ent.seq);
    return "t:" + String(ent.ts) + ":" + String(ent.text || "").slice(0, 80);
  }

  function pushConversationGroupedEvent(groups, pidUse, cidUse, ent, p, tier, meta) {
    if (!cidUse) return;
    if (!pidUse) pidUse = "(unknown principal)";
    var keyC = pidUse + "\0" + cidUse;
    if (!groups[keyC]) groups[keyC] = { pid: pidUse, cid: cidUse, events: [] };
    var g = groups[keyC];
    var dk = convEventDedupeKey(ent);
    for (var ei = 0; ei < g.events.length; ei++) {
      if (convEventDedupeKey(g.events[ei]) === dk) return;
    }
    var outEv = {
      parsed: p,
      text: ent.text || "",
      ts: ent.ts,
      seq: ent.seq,
      convJoinTier: tier
    };
    if (meta && typeof meta === "object") {
      if (meta.span_id) outEv.vectorstoreSpanID = String(meta.span_id);
      if (meta.turn_index != null) outEv.vectorstoreTurnIndex = meta.turn_index;
      if (meta.span_start_ms != null) outEv.vectorstoreSpanStartMs = meta.span_start_ms;
    }
    g.events.push(outEv);
  }

  function entryIsVectorstoreSubprocessForConvJoin(ent) {
    var f = getFlat(ent.parsed);
    if (String(f.service || "").toLowerCase() !== "chimera-vectorstore") return false;
    var msg = String(f.msg != null ? f.msg : "").toLowerCase();
    return msg.indexOf("chimera-vectorstore.") === 0;
  }

  function conversationRequestIdTier2EligibleLocal(f) {
    if (globalThis.ChimeraLogs && ChimeraLogs.Derive && typeof ChimeraLogs.Derive.conversationRequestIdTier2Eligible === "function") {
      return ChimeraLogs.Derive.conversationRequestIdTier2Eligible(f);
    }
    return (
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      ChimeraLogs.Derive.conversationChimeraBrokerTimelineFlat &&
      ChimeraLogs.Derive.conversationChimeraBrokerTimelineFlat(f)
    );
  }

  function conversationIndexRunTier3EligibleLocal(f) {
    if (globalThis.ChimeraLogs && ChimeraLogs.Derive && typeof ChimeraLogs.Derive.conversationIndexRunTier3Eligible === "function") {
      return ChimeraLogs.Derive.conversationIndexRunTier3Eligible(f);
    }
    return false;
  }

  /**
   * Register request_id → (principal, conversation_id) only from authoritative gateway rows.
   * First mapping wins. Primary pass prefers lifecycle / chat.request / chat access so later rows
   * (or RAG lines that may appear early) cannot re-point a request at another conversation card.
   */
  function tryRegisterRequestConversationCorrelationPrimary(reqToConv, f) {
    if (!f || typeof f !== "object") return;
    var rid = f.request_id != null ? String(f.request_id).trim() : "";
    var cid = f.conversation_id != null ? String(f.conversation_id).trim() : "";
    var pid = f.principal_id != null ? String(f.principal_id).trim() : f.tenant != null ? String(f.tenant).trim() : "";
    if (!rid || !cid || !pid || reqToConv[rid]) return;
    var msg = String(f.msg != null ? f.msg : f.message != null ? f.message : "").trim();
    if (msg === "conversation.received" || msg === "chat.request") {
      reqToConv[rid] = { pid: pid, cid: cid };
      return;
    }
    var ml = msg.toLowerCase();
    if (ml === "gateway.http.access" || ml === "http response") {
      var pth = String(f.path || "").split("?")[0];
      if (pth.indexOf("/v1/chat/completions") >= 0) {
        reqToConv[rid] = { pid: pid, cid: cid };
      }
    }
  }

  function tryRegisterRequestConversationCorrelationRagFallback(reqToConv, f) {
    if (!f || typeof f !== "object") return;
    var rid = f.request_id != null ? String(f.request_id).trim() : "";
    var cid = f.conversation_id != null ? String(f.conversation_id).trim() : "";
    var pid = f.principal_id != null ? String(f.principal_id).trim() : f.tenant != null ? String(f.tenant).trim() : "";
    if (!rid || !cid || !pid || reqToConv[rid]) return;
    var msg = String(f.msg != null ? f.msg : f.message != null ? f.message : "").trim();
    if (msg === "rag.query" || msg === "rag.embed") {
      reqToConv[rid] = { pid: pid, cid: cid };
    }
  }

  function conversationCardStatus(g, t1, cardModel) {
    cardModel = cardModel || conversationCardModelForGroup(g.events);
    if (cardModel.stateKind === "error") {
      return { st: cardModel.stateLabel || "error", cls: "sum-st-error" };
    }
    if (cardModel.stateKind === "warn") {
      return { st: cardModel.stateLabel || "warn", cls: "sum-st-indexing" };
    }
    if (recentConvEventsHaveError(g.events)) return { st: "error", cls: "sum-st-error" };
    var now = Date.now();
    if (t1 && now - t1.getTime() < 45000) return { st: "active", cls: "sum-st-active sum-pulse" };
    var stLab = cardModel.stateLabel && cardModel.stateLabel !== "—" ? cardModel.stateLabel : "complete";
    return { st: stLab, cls: "sum-st-complete" };
  }

  function countWarnErrorInEntries(arr) {
    var n = 0;
    for (var i = 0; i < arr.length; i++) {
      var lv = arr[i].parsed.levelCanon || "";
      if (lv === "ERROR" || lv === "WARN") n++;
      var gfw = getFlat(arr[i].parsed);
      var sc = Number(gfw.statusCode);
      if (!isNaN(sc) && sc >= 400) n++;
      var msgW = String(gfw.msg || "").toLowerCase();
      if (msgW.indexOf("chimera-vectorstore.http.") === 0 && gfw.http_status != null) {
        var hs = Number(gfw.http_status);
        if (!isNaN(hs) && hs !== 200) n++;
      }
    }
    return n;
  }

  function sliceRecent(arr, n) {
    if (!arr || !arr.length) return [];
    var take = Math.min(n, arr.length);
    return arr.slice(-take);
  }

  /** Latest supervised bootstrap line (indexer waiting for watch roots); drives service card idle pill + subtitle. */
  function indexerLatestSupervisedWaitFlat(entries) {
    var slice = sliceRecent(entries, RECENT_CARD_STATUS_N);
    for (var i = slice.length - 1; i >= 0; i--) {
      var f = getFlat(slice[i].parsed);
      if (String(f.service || "").toLowerCase() !== "indexer") continue;
      var typ = f.type != null ? String(f.type).trim() : "";
      if (typ === "indexer.supervised.wait_roots") return f;
      var m = indexerFlatMsg(f);
      if (m === "indexer.supervised.wait_roots") return f;
    }
    return null;
  }

  /** Card pill "error": ERROR level or HTTP status ≥400 (not WARN — avoids noisy strips). */
  function entryHasErrorStatus(ent) {
    var p = ent.parsed;
    if (!p) return false;
    if (p.levelCanon === "ERROR") return true;
    var fp = getFlat(p);
    var sc = Number(fp.statusCode);
    if (!isNaN(sc) && sc >= 400) return true;
    var msgQ = String(fp.msg || "").toLowerCase();
    if (msgQ.indexOf("chimera-vectorstore.http.") === 0 && fp.http_status != null) {
      var hq = Number(fp.http_status);
      if (!isNaN(hq) && hq !== 200) return true;
    }
    return false;
  }

  function chimeraBrokerEntryHasRateLimit(ent) {
    if (globalThis.ChimeraLogs && globalThis.ChimeraLogs.Derive && globalThis.ChimeraLogs.Derive.chimeraBrokerEntryHasRateLimit) {
      return globalThis.ChimeraLogs.Derive.chimeraBrokerEntryHasRateLimit(ent, function (p) { return getFlat(p); });
    }
    var comb = (ent.text || "").toLowerCase() + String(getFlat(ent.parsed).msg || "").toLowerCase();
    return comb.indexOf("429") >= 0 || comb.indexOf("rate limit") >= 0 || comb.indexOf("rate_limit") >= 0;
  }

  function countErrorSignalsInEntries(arr) {
    var n = 0;
    for (var i = 0; i < arr.length; i++) {
      if (entryHasErrorStatus(arr[i])) n++;
    }
    return n;
  }

  function recentServiceCardHasError(name, arr) {
    var slice = sliceRecent(arr, RECENT_CARD_STATUS_N);
    for (var i = 0; i < slice.length; i++) {
      if (entryHasErrorStatus(slice[i])) return true;
      if (name === "chimera-broker" && chimeraBrokerEntryHasRateLimit(slice[i])) return true;
    }
    return false;
  }

  function recentConvEventsHaveError(events) {
    var slice = sliceRecent(events, RECENT_CARD_STATUS_N);
    for (var i = 0; i < slice.length; i++) {
      var p = slice[i].parsed;
      if (p.levelCanon === "ERROR") return true;
      var sc = Number(getFlat(p).statusCode);
      if (!isNaN(sc) && sc >= 400) return true;
    }
    return false;
  }

  /**
   * Bar segment colors / legend labels (keep in sync with inferServiceBadge; gateway HTTP lines also carry
   * flat.timeline_kind from the gateway — see internal/server/timeline_kind.go).
   */
  var TIMELINE_BAR_KINDS = [
    { key: "web", bg: "#42a5f5", label: "Web", title: "Inbound HTTP and API access lines" },
    { key: "chimera-vectorstore", bg: "#66bb6a", label: "chimera-vectorstore", title: "chimera-vectorstore wrapper and backend lines" },
    { key: "chimera-broker", bg: "#9575cd", label: "chimera-broker", title: "chimera-broker relay and upstream chat traffic" },
    { key: "chimera-indexer", bg: "#ffa726", label: "chimera-indexer", title: "chimera-indexer subprocess lines" },
    { key: "chimera-gateway", bg: "#78909c", label: "chimera-gateway", title: "chimera-gateway routing, startup, config, and other internal logs" }
  ];

  /** Shared with timelineBarHtml and indexer scope cards (same `.sum-timeline-bar` DOM). */
  function timelineSegmentsHtml(segments) {
    var html = '<div class="sum-timeline-bar">';
    for (var i = 0; i < segments.length; i++) {
      var pct = segments[i].pct;
      var bg = segments[i].bg;
      if (pct < 0.05) continue;
      html +=
        '<span class="sum-timeline-seg" style="width:' +
        Number(pct).toFixed(1) +
        "%;background:" +
        bg +
        '"></span>';
    }
    return html + "</div>";
  }

  function timelineBarHtml(evList) {
    var counts = { web: 0, vectorstore: 0, broker: 0, indexer: 0, gateway: 0 };
    for (var i = 0; i < evList.length; i++) {
      var lab = timelineKindLab(evList[i]);
      if (lab === "web") counts.web++;
      else if (lab === "chimera-vectorstore") counts.vectorstore++;
      else if (lab === "chimera-broker") counts.broker++;
      else if (lab === "chimera-indexer") counts.indexer++;
      else counts.gateway++;
    }
    var total = counts.web + counts.vectorstore + counts.broker + counts.indexer + counts.gateway || 1;
    var segments = [];
    for (var k = 0; k < TIMELINE_BAR_KINDS.length; k++) {
      var kind = TIMELINE_BAR_KINDS[k];
      var pct = (counts[kind.key] / total) * 100;
      if (pct < 0.05) continue;
      segments.push({ pct: pct, bg: kind.bg });
    }
    return timelineSegmentsHtml(segments);
  }

  /** Swatches for timelineBarHtml segment colors (gateway service panel). */
  function timelineLegendHtml() {
    var parts = [];
    for (var i = 0; i < TIMELINE_BAR_KINDS.length; i++) {
      var row = TIMELINE_BAR_KINDS[i];
      parts.push(
        '<span class="sum-timeline-legend-item" title="' +
          escapeHtml(row.title) +
          '">' +
          '<span class="sum-timeline-legend-swatch" style="background:' +
          row.bg +
          '"></span>' +
          '<span class="sum-timeline-legend-label">' +
          escapeHtml(row.label) +
          "</span></span>"
      );
    }
    return '<div class="sum-timeline-legend">' + parts.join("") + "</div>";
  }

  /**
   * Scope completion bar: indexer orange (#ffa726, same as timelineBarHtml) for all fills (no idle-green strip).
   * Uses the same `.sum-timeline-bar` structure as timelineBarHtml.
   */
  function indexerScopeProgressTimelineBarHtml(pRem, qTot, doneSeen) {
    var orange = "#ffa726";
    if (doneSeen) {
      return timelineSegmentsHtml([{ pct: 100, bg: orange }]);
    }
    if (pRem !== null && !isNaN(Number(pRem)) && Number(pRem) === 0 && qTot !== null && !isNaN(Number(qTot)) && Number(qTot) >= 0) {
      return timelineSegmentsHtml([{ pct: 100, bg: orange }]);
    }
    if (qTot != null && !isNaN(Number(qTot)) && Number(qTot) > 0 && pRem != null && !isNaN(Number(pRem))) {
      var q = Number(qTot);
      var r = Number(pRem);
      var done = q - r;
      var pctDone = (done / q) * 100;
      if (pctDone < 0) pctDone = 0;
      if (pctDone > 100) pctDone = 100;
      if (pctDone > 0 && pctDone < 0.05) pctDone = 0.05;
      return timelineSegmentsHtml([{ pct: pctDone, bg: orange }]);
    }
    return timelineSegmentsHtml([]);
  }

  function serviceWindowMs(arr) {
    var t0 = null;
    var t1 = null;
    for (var i = 0; i < arr.length; i++) {
      var ins = entryInstant(arr[i]);
      if (ins) {
        if (!t0 || ins.getTime() < t0.getTime()) t0 = ins;
        if (!t1 || ins.getTime() > t1.getTime()) t1 = ins;
      }
    }
    return t0 && t1 ? t1.getTime() - t0.getTime() : 0;
  }

  function chimeraBrokerLastRelayRequestFlat(arr) {
    for (var i = arr.length - 1; i >= 0; i--) {
      var f = getFlat(arr[i].parsed);
      var msg = String(f.msg != null ? f.msg : f.message != null ? f.message : "").trim();
      if (msg === "chat.chimera-broker.request") return f;
    }
    return null;
  }

  /** One-line summary for collapsed chimera-broker card from a chat.chimera-broker.request row (no body excerpt / raw JSON). */
  function summarizeChimeraBrokerRelayRequest(f) {
    if (!f) return "";
    var model = chimeraBrokerShortModelLabel(f.upstreamModel != null ? String(f.upstreamModel).trim() : "—");
    var stream =
      f.stream === true || f.stream === "true"
        ? "SSE"
        : f.stream === false || f.stream === "false"
          ? "JSON"
          : "";
    var path = f.path != null && String(f.path).trim() !== "" ? String(f.path).trim() : "/v1/chat/completions";
    var ot = Number(f.outgoingTokens);
    var tokStr = !isNaN(ot) && ot > 0 ? formatInt(Math.round(ot)) + " tok out" : "";
    var bits = ["Last relay", "POST", path];
    if (model && model !== "—") bits.push(model);
    if (stream) bits.push(stream);
    if (tokStr) bits.push(tokStr);
    var line = bits.join(" · ");
    if (line.length > 220) line = line.slice(0, 217) + "…";
    return line;
  }

  /** Collapsed-card subtitle: prefer recent alerts, else last upstream relay request summary, else last response hint. */
  function chimeraBrokerCollapsedCardSubtitle(arr) {
    if (!arr.length) return "";
    var tailN = Math.min(12, arr.length);
    var t0 = Math.max(0, arr.length - tailN);
    var ti;
    for (ti = arr.length - 1; ti >= t0; ti--) {
      var f429 = getFlat(arr[ti].parsed);
      var m429 = String(f429.msg != null ? f429.msg : "").trim();
      if (m429 === "chimera-broker.rate_limit") {
        return "429 rate-limit (broker HTTP)";
      }
    }
    for (ti = arr.length - 1; ti >= t0; ti--) {
      var raw = String(arr[ti].text || "");
      var m0 = String(getFlat(arr[ti].parsed).msg || "");
      var s = (raw + " " + m0).toLowerCase();
      if (s.indexOf("429") >= 0 || (s.indexOf("rate") >= 0 && s.indexOf("limit") >= 0)) {
        var retry = "5s";
        var rm = s.match(/retry[^\d]*(\d+)\s*s/);
        if (rm) retry = rm[1] + "s";
        var ra = s.match(/retry-after[:\s]+(\d+)/);
        if (ra) retry = ra[1] + "s";
        return "429 rate-limit — retry in " + retry;
      }
    }
    for (ti = arr.length - 1; ti >= t0; ti--) {
      var fe = getFlat(arr[ti].parsed);
      var merr = String(fe.msg != null ? fe.msg : "").trim();
      if (merr === "chat.chimera-broker.error" || merr.indexOf("chimera-broker.error") >= 0) {
        var es = String(fe.err != null ? fe.err : "").replace(/\s+/g, " ").trim();
        if (!es && arr[ti].text) {
          try {
            var jo = tryParseJSONObject(arr[ti].text);
            if (jo && jo.err != null && jo.err !== "") {
              es = typeof jo.err === "object" ? JSON.stringify(jo.err).slice(0, 120) : String(jo.err);
            }
          } catch (x) { }
        }
        if (es.length > 140) es = es.slice(0, 138) + "…";
        return "Upstream fetch failed" + (es ? ": " + es : "");
      }
    }
    for (ti = arr.length - 1; ti >= t0; ti--) {
      var fh = getFlat(arr[ti].parsed);
      var mh = String(fh.msg || "").trim();
      if (mh === "chimera-broker.provider.health.fail") {
        var pdn = fh.provider_id != null ? String(fh.provider_id).trim() : "";
        return "Provider health down" + (pdn ? ": " + pdn : "");
      }
      if (mh === "chimera-broker.provider.key_missing") {
        var pk = fh.provider_id != null ? String(fh.provider_id).trim() : "";
        return "Missing key" + (pk ? " for " + pk : "");
      }
    }
    var reqF = chimeraBrokerLastRelayRequestFlat(arr);
    if (reqF) return summarizeChimeraBrokerRelayRequest(reqF);
    for (var rj = arr.length - 1; rj >= 0; rj--) {
      var fr = getFlat(arr[rj].parsed);
      var mr = String(fr.msg || "").trim();
      if (mr === "upstream chat response" || mr === "chat.chimera-broker.response") {
        var sc = fr.statusCode != null && fr.statusCode !== "" ? String(fr.statusCode) : "—";
        var ut = Number(fr.usageTotalTokens);
        var up = Number(fr.usagePromptTokens);
        var uc = Number(fr.usageCompletionTokens);
        var uTot = !isNaN(ut) && ut > 0 ? ut : (!isNaN(up) || !isNaN(uc) ? (isNaN(up) ? 0 : up) + (isNaN(uc) ? 0 : uc) : 0);
        var uS = uTot > 0 ? formatInt(Math.round(uTot)) + " tok usage" : "";
        var mod = chimeraBrokerShortModelLabel(fr.upstreamModel != null ? String(fr.upstreamModel).trim() : "—");
        var bits = ["Last response", "HTTP " + sc];
        if (mod && mod !== "—") bits.push(mod);
        if (uS) bits.push(uS);
        return bits.join(" · ");
      }
    }
    return "Idle — no chat calls relayed yet";
  }

  /** Aggregate metrics for the chimera-broker service card from gateway upstream relay / response logs. */
  function chimeraBrokerCardMetrics(arr) {
    if (globalThis.ChimeraLogs && globalThis.ChimeraLogs.Derive && globalThis.ChimeraLogs.Derive.chimeraBrokerCardMetrics) {
      return globalThis.ChimeraLogs.Derive.chimeraBrokerCardMetrics(arr, function (p) { return getFlat(p); });
    }
    return { reqN: 0, resN: 0, errN: 0, streamOn: 0, streamOff: 0, outgoingSum: 0, usageSum: 0, bytesSum: 0, sc2xx: 0, scErr: 0, topModel: "—", rlN: 0, relayOk: 0, relayFail: 0, rateLimitSlugN: 0, relay429N: 0, rateLimitBoxN: 0, fallbackN: 0, providersTotal: 0, providersUp: 0, providersAnyDown: false };
  }

  function chimeraBrokerProviderHealthResolve(arr) {
    var stateColor = { up: "#66bb6a", down: "#ef5350", key_missing: "#ffa726", unknown: "#bdbdbd" };
    var stateLabel = { up: "up", down: "down", key_missing: "key missing", unknown: "unknown" };
    var list = null;
    var liveErr = "";
    if (ctx.chimeraBrokerProviderSnapshot && ctx.chimeraBrokerProviderSnapshot.data && Array.isArray(ctx.chimeraBrokerProviderSnapshot.data.providers)) {
      var snapshotAgeMs = Date.now() - Number(ctx.chimeraBrokerProviderSnapshot.fetchedClientMs || 0);
      if (snapshotAgeMs <= CHIMERA_BROKER_PROVIDER_STALE_MS) {
        list = ctx.chimeraBrokerProviderSnapshot.data.providers.slice();
        liveErr = String(ctx.chimeraBrokerProviderSnapshot.data.error || "").trim();
      }
    }
    if (!list && globalThis.ChimeraLogs && ChimeraLogs.Derive && typeof ChimeraLogs.Derive.chimeraBrokerProviderHealthList === "function") {
      list = ChimeraLogs.Derive.chimeraBrokerProviderHealthList(arr, function (p) { return getFlat(p); });
    }
    return {
      list: list,
      liveErr: liveErr,
      emptyMsg: liveErr ? "chimera-broker unreachable" : "No providers loaded yet",
      stateColor: stateColor,
      stateLabel: stateLabel
    };
  }

  function chimeraBrokerProviderHealthSegTitle(entry, lab) {
    var titleBits = [String((entry || {}).id || "—") + " · " + lab];
    var keyHint = entry.key_hint != null ? String(entry.key_hint) : "";
    var keyCount = entry.key_count != null && !isNaN(Number(entry.key_count)) ? Number(entry.key_count) : null;
    if (keyCount != null) titleBits.push(keyCount + (keyCount === 1 ? " key" : " keys"));
    if (keyHint) titleBits.push(keyHint);
    if (entry.ollama_base_url) titleBits.push("base " + entry.ollama_base_url);
    if (entry.error) titleBits.push("err: " + entry.error);
    return titleBits.join(" · ");
  }

  /**
   * Provider-health strip: one segment per configured provider, colored by latest probe.
   * Visually aligned with conversation lifecycle bars (gapped segments; outer corners rounded).
   *
   * Source preference (high → low):
   *   1. Live snapshot from /api/ui/chimera-broker/providers (refreshed every 30s) — authoritative
   *      because Chimera Broker (this build) doesn't slog per-provider lifecycle events, so the log
   *      buffer alone can't enumerate groq / gemini / ollama.
   *   2. Log-derived list via `ChimeraLogs.Derive.chimeraBrokerProviderHealthList` — fallback when
   *      the live snapshot is missing or stale (>90s) so an offline view still has something.
   *   3. Empty caption ("No providers loaded yet" / "chimera-broker unreachable") when neither source
   *      yields entries.
   *
   * opts.compact: collapsed Chimera Broker service card — up to three gapped indicators, no labels.
   */
  function chimeraBrokerProviderHealthStripHtml(arr, opts) {
    opts = opts || {};
    var compact = !!opts.compact;
    var R = chimeraBrokerProviderHealthResolve(arr);
    var list = R.list;
    var stateColor = R.stateColor;
    var stateLabel = R.stateLabel;

    if (compact) {
      var trackTitle = R.emptyMsg;
      var segs = [];
      if (list && list.length) {
        var cap = list.length > 3 ? 3 : list.length;
        trackTitle =
          list.length > 3
            ? "Provider probe status (first " + cap + " of " + list.length + ")"
            : "Provider probe status";
        for (var ci = 0; ci < cap; ci++) {
          var entC = list[ci] || {};
          var stC = stateColor[entC.state] ? entC.state : "unknown";
          var labC = stateLabel[stC];
          segs.push(
            '<span class="sum-bf-prov-health-seg" title="' +
              escapeHtml(chimeraBrokerProviderHealthSegTitle(entC, labC)) +
              '" style="background:' +
              stateColor[stC] +
              '"></span>'
          );
        }
      } else {
        for (var zi = 0; zi < 3; zi++) {
          segs.push(
            '<span class="sum-bf-prov-health-seg" title="' +
              escapeHtml(R.emptyMsg) +
              '" style="background:' +
              stateColor.unknown +
              '"></span>'
          );
        }
      }
      return (
        '<div id="chimera-broker-provider-health-compact" class="sum-bf-prov-health-root sum-bf-prov-health-root--compact" role="img" aria-label="' +
        escapeHtml(trackTitle) +
        '">' +
        '<div class="sum-bf-prov-health-track sum-bf-prov-health-track--compact" title="' +
        escapeHtml(trackTitle) +
        '">' +
        segs.join("") +
        "</div></div>"
      );
    }

    var rootOpen = '<div id="chimera-broker-provider-health-strip" class="sum-bf-prov-health-root">';
    if (!list || !list.length) {
      return (
        rootOpen +
        '<div class="sum-bf-prov-health-track sum-bf-prov-health-track--empty" title="' +
        escapeHtml(R.emptyMsg) +
        '">' +
        '<span class="sum-bf-prov-health-seg sum-bf-prov-health-seg--empty" title="' +
        escapeHtml(R.emptyMsg) +
        '" style="background:' +
        stateColor.unknown +
        '"></span></div>' +
        '<div class="sum-strip-caption sum-strip-caption--muted">' +
        escapeHtml(R.emptyMsg) +
        "</div></div>"
      );
    }
    var trackParts = [];
    var labelParts = [];
    for (var i = 0; i < list.length; i++) {
      var entry = list[i] || {};
      var st = stateColor[entry.state] ? entry.state : "unknown";
      var bg = stateColor[st];
      var lab = stateLabel[st];
      trackParts.push(
        '<span class="sum-bf-prov-health-seg" title="' +
          escapeHtml(chimeraBrokerProviderHealthSegTitle(entry, lab)) +
          '" style="background:' +
          bg +
          '"></span>'
      );
      labelParts.push(
        '<span class="sum-bf-prov-health-label" title="' +
          escapeHtml(chimeraBrokerProviderHealthSegTitle(entry, lab)) +
          '">' +
          escapeHtml(String(entry.id || "—")) +
          "</span>"
      );
    }
    return (
      rootOpen +
      '<div class="sum-bf-prov-health-track" title="One segment per configured provider, colored by latest health probe">' +
      trackParts.join("") +
      '</div><div class="sum-bf-prov-health-labels">' +
      labelParts.join("") +
      "</div></div>"
    );
  }

  /**
   * Relay-outcome strip: buckets every chat relay row in the buffer by HTTP outcome.
   * Replaces the legacy generic "Request timeline" mix bar on the Chimera Broker panel
   * (which was always 100% purple because every Chimera Broker row maps to "upstream").
   * Backed by `ChimeraLogs.Derive.chimeraBrokerRelayOutcomeBuckets`.
   */
  function chimeraBrokerRelayOutcomeStripHtml(arr) {
    var b = null;
    if (
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.chimeraBrokerRelayOutcomeBuckets === "function"
    ) {
      b = ChimeraLogs.Derive.chimeraBrokerRelayOutcomeBuckets(arr, function (p) { return getFlat(p); });
    }
    if (!b || !b.total) {
      return (
        '<div class="sum-timeline-bar sum-timeline-bar--relay-outcome"></div>' +
        '<div class="sum-strip-caption sum-strip-caption--muted">No chat relay activity yet</div>'
      );
    }
    var palette = [
      { key: "ok", label: "2xx", color: "#66bb6a" },
      { key: "redirect", label: "3xx", color: "#42a5f5" },
      { key: "rateLimit", label: "429", color: "#fb8c00" },
      { key: "clientErr", label: "4xx", color: "#ffa726" },
      { key: "serverErr", label: "5xx", color: "#ef5350" },
      { key: "errorNoResp", label: "fetch err", color: "#c62828" },
      { key: "inFlight", label: "in flight", color: "#9575cd" }
    ];
    var html = '<div class="sum-timeline-bar sum-timeline-bar--relay-outcome" title="Chat relay outcomes since last chimera-broker ready (HTTP buckets + fetch errors + in-flight)">';
    var captionParts = [];
    for (var i = 0; i < palette.length; i++) {
      var p = palette[i];
      var n = Number(b[p.key] || 0);
      if (n <= 0) continue;
      var pct = (n / b.total) * 100;
      if (pct < 0.05) pct = 0.05;
      html +=
        '<span class="sum-timeline-seg" title="' +
        escapeHtml(p.label + " · " + n) +
        '" style="width:' +
        pct.toFixed(2) +
        "%;background:" +
        p.color +
        '"></span>';
      captionParts.push(
        formatInt(n) +
        ' <span class="sum-strip-caption-state sum-strip-caption-state--' +
        p.key +
        '">' +
        escapeHtml(p.label) +
        "</span>"
      );
    }
    html += "</div>";
    html += '<div class="sum-strip-caption">' + captionParts.join(" · ") + "</div>";
    return html;
  }

  function chimeraBrokerShortModelLabel(model) {
    if (!model || model === "—") return "—";
    var parts = String(model).split("/");
    var tail = parts[parts.length - 1] || model;
    if (tail.length > 36) return tail.slice(0, 34) + "…";
    return tail;
  }

  function badgeForServicePanel(name, ev) {
    if (name === "chimera-broker") {
      var w = { parsed: ev.parsed, text: ev.text, ts: ev.ts, source: ev.source };
      if (entryIsGatewayUpstreamRelay(w)) {
        return { cls: "sum-svc-broker sum-svc-badge-filled sum-svc-broker-filled", lab: "chimera-broker" };
      }
      return null;
    }
    return inferServiceBadge(ev);
  }

  /** How long file-level indexer activity stays “fresh” for UI subtitle hints. */
  var INDEXER_IDLE_RECENCY_MS = 120000;

  /** Human label for indexer.state code — canonical mapping lives in derive/indexerPresent.js (goja-tested). */
  function indexerHumanDeclaredState(code) {
    if (
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.indexerDeclaredStateLabel === "function"
    ) {
      return ChimeraLogs.Derive.indexerDeclaredStateLabel(code);
    }
    return code ? String(code) : "";
  }

  function indexerLastFileEventTime(evs) {
    for (var i = evs.length - 1; i >= 0; i--) {
      var f = getFlat(evs[i].parsed);
      var m = indexerFlatMsg(f);
      if (m === "indexer.scope.active_file") {
        var insA = entryInstant(evs[i]);
        if (insA) return insA.getTime();
      }
      if (
        m === "chimera-indexer.job.upload" ||
        m === "chimera-indexer.job.ingested" ||
        m === "chimera-indexer.job.skipped" ||
        m.indexOf("chimera-indexer.retry") === 0 ||
        m.indexOf("chimera-indexer.job.failed") === 0
      ) {
        var ins = entryInstant(evs[i]);
        if (ins) return ins.getTime();
      }
    }
    return 0;
  }

  function indexerRelFromLatestFileLine(evs) {
    for (var i = evs.length - 1; i >= 0; i--) {
      var f = getFlat(evs[i].parsed);
      var mEarly = indexerFlatMsg(f);
      if (mEarly === "indexer.scope.active_file" && f.rel) return String(f.rel);
      if (!f.rel) continue;
      var m = indexerFlatMsg(f);
      if (
        m === "chimera-indexer.job.upload" ||
        m === "chimera-indexer.job.ingested" ||
        m === "chimera-indexer.job.skipped" ||
        m.indexOf("chimera-indexer.retry") === 0 ||
        m.indexOf("chimera-indexer.job.failed") === 0
      ) {
        return String(f.rel);
      }
    }
    return "";
  }

  function indexerBuildCardSubtitle(meta, evs) {
    var stateLine = indexerHumanDeclaredState(meta.lastDeclaredState);
    var ft = indexerLastFileEventTime(evs);
    if (!stateLine) {
      var cand =
        meta.lastProg && meta.lastProg.candidates_enqueued != null
          ? String(meta.lastProg.candidates_enqueued)
          : "—";
      stateLine = indexerRunProgressSubtitle(meta.lastProg, meta.doneSeen, cand);
    }

    var rp = meta && meta.scopeLatestRel ? String(meta.scopeLatestRel).trim() : "";
    if (!rp) rp = indexerRelFromLatestFileLine(evs);
    if (rp) {
      var recent = ft && Date.now() - ft <= INDEXER_IDLE_RECENCY_MS;
      var pathShow = recent ? rp : "last file: " + rp;
      return stateLine ? stateLine + " — " + pathShow : pathShow;
    }
    return stateLine || "—";
  }

  var INDEXER_HIST_COLS = {
    lifecycle: "#5c6bc0",
    discovery: "#7e57c2",
    jobs: "#fb8c00",
    queue: "#29b6f6",
    statestats: "#26a69a",
    config: "#78909c",
    recovery: "#ef5350",
    indexer_misc: "#9e9e9e",
    other: "#bdbdbd"
  };

  function indexerEventMixHistogramHtml(evs) {
    var counts = {
      lifecycle: 0,
      discovery: 0,
      jobs: 0,
      queue: 0,
      statestats: 0,
      config: 0,
      recovery: 0,
      indexer_misc: 0,
      other: 0
    };
    var bucketFn =
      globalThis.ChimeraLogs &&
        ChimeraLogs.Derive &&
        typeof ChimeraLogs.Derive.indexerSlugHistogramBucket === "function"
        ? function (msg) {
          return ChimeraLogs.Derive.indexerSlugHistogramBucket(msg);
        }
        : function () {
          return "other";
        };
    for (var i = 0; i < evs.length; i++) {
      var m = indexerFlatMsg(getFlat(evs[i].parsed));
      var b = bucketFn(m);
      if (counts[b] === undefined) counts.other++;
      else counts[b]++;
    }
    var total = evs.length || 1;
    var order = [
      "jobs",
      "queue",
      "statestats",
      "discovery",
      "lifecycle",
      "recovery",
      "config",
      "indexer_misc",
      "other"
    ];
    var html = '<div class="sum-timeline-bar indexer-event-mix-bar" title="Share of loaded log lines by indexer message category">';
    for (var o = 0; o < order.length; o++) {
      var key = order[o];
      var c = counts[key] || 0;
      var pct = (c / total) * 100;
      if (pct < 0.05) continue;
      html +=
        '<span class="sum-timeline-seg" style="width:' +
        pct.toFixed(1) +
        "%;background:" +
        (INDEXER_HIST_COLS[key] || INDEXER_HIST_COLS.other) +
        '"></span>';
    }
    return html + "</div>";
  }

  function indexerHistogramLegendHtml() {
    var order = [
      ["jobs", "file jobs"],
      ["queue", "queue snapshots"],
      ["statestats", "state / vectorstore stats"],
      ["discovery", "discovery / inventory"],
      ["lifecycle", "run start · done"],
      ["recovery", "retry / recovery"],
      ["config", "gateway config"],
      ["indexer_misc", "other indexer"],
      ["other", "other lines"]
    ];
    var parts = [];
    for (var o = 0; o < order.length; o++) {
      var k = order[o][0];
      var lab = order[o][1];
      var col = INDEXER_HIST_COLS[k] || INDEXER_HIST_COLS.other;
      parts.push(
        '<span class="indexer-mix-legend-item"><span class="indexer-mix-swatch" style="background:' +
        col +
        '"></span>' +
        escapeHtml(lab) +
        "</span>"
      );
    }
    return '<div class="indexer-mix-legend">' + parts.join("") + "</div>";
  }

  function badgeForIndexerRunLine(ent) {
    var src = (ent.source || "").toLowerCase();
    var f = getFlat(ent.parsed);
    var msg = String(f.msg || "").toLowerCase();
    if (src === "chimera-vectorstore" || src === "chimera-vectorstore" || msg.indexOf("chimera-vectorstore") >= 0)
      return { cls: "sum-svc-chimera-vectorstore sum-svc-badge-filled sum-svc-chimera-vectorstore-filled", lab: "chimera-vectorstore" };
    return { cls: "sum-svc-chimera-indexer sum-svc-badge-filled sum-svc-chimera-indexer-filled", lab: "chimera-indexer" };
  }

  function indexerRunProgressSubtitle(lastProg, doneSeen, candStr) {
    var lp = lastProg || {};
    var cur =
      lp.chunks_embedded != null
        ? Number(lp.chunks_embedded)
        : lp.chunks_done != null
          ? Number(lp.chunks_done)
          : lp.embedded_chunks != null
            ? Number(lp.embedded_chunks)
            : null;
    var tot =
      lp.chunks_total != null
        ? Number(lp.chunks_total)
        : lp.total_chunks != null
          ? Number(lp.total_chunks)
          : null;
    if (cur != null && tot != null && !isNaN(cur) && !isNaN(tot))
      return "Indexer uploading batch — " + cur + " of " + tot + " chunks embedded";
    if (candStr && candStr !== "—")
      return "Indexer uploading batch — latest counters: " + candStr + " candidates / chunks";
    return doneSeen ? "Indexer run completed" : "Indexer uploading batch — in progress";
  }

  /** Primary log `msg` / `message` (slog may put the human title in one and the slug in the other, or duplicate keys). */
  function indexerFlatMsg(fl) {
    if (
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.indexerFlatMsgForPresent === "function"
    )
      return ChimeraLogs.Derive.indexerFlatMsgForPresent(fl);
    return String(fl.msg != null ? fl.msg : fl.message != null ? fl.message : "")
      .toLowerCase()
      .trim();
  }

  /** True when flat is an indexer.state snapshot (slug or human title / structured fields). */
  function isIndexerStateFlat(f) {
    if (!f || typeof f !== "object") return false;
    if (indexerFlatMsg(f) === "indexer.state") return true;
    var raw = String(f.msg != null ? f.msg : f.message != null ? f.message : "")
      .toLowerCase()
      .trim();
    if (
      (raw === "indexer state" || raw === "indexer.state") &&
      (f.queue_depth != null || f.ingest_inflight != null || f.state != null || typeof f.watch_mode === "boolean")
    )
      return true;
    return false;
  }

  /** Latest process-wide queue depth / ingest inflight from the newest indexer.state in the log window. */
  function latestIndexerStateQueueInflightFromEntries(arr) {
    var qd = null,
      inf = null;
    if (!Array.isArray(arr)) return { queueDepth: qd, ingestInflight: inf };
    for (var i = arr.length - 1; i >= 0; i--) {
      var f = getFlat(arr[i].parsed);
      if (!isIndexerStateFlat(f)) continue;
      if (f.queue_depth != null) {
        var n = Number(f.queue_depth);
        if (!isNaN(n)) qd = n;
      }
      if (f.ingest_inflight != null) {
        var n2 = Number(f.ingest_inflight);
        if (!isNaN(n2)) inf = n2;
      }
      break;
    }
    return { queueDepth: qd, ingestInflight: inf };
  }

  /** Latest queue_cap and workers from the newest indexer.queue.snapshot in the log window. */
  function latestIndexerQueueSnapshotMetaFromEntries(arr) {
    var cap = null;
    var workers = null;
    if (!Array.isArray(arr)) return { queueCap: cap, workers: workers };
    for (var i = arr.length - 1; i >= 0; i--) {
      var f = getFlat(arr[i].parsed);
      var m = indexerFlatMsg(f);
      if (m !== "chimera-indexer.queue.snapshot" && m.indexOf("chimera-indexer.queue.snapshot") !== 0) continue;
      if (f.queue_cap != null && f.queue_cap !== "") {
        var c = Number(f.queue_cap);
        if (!isNaN(c)) cap = c;
      }
      if (f.workers != null && f.workers !== "") {
        var w = Number(f.workers);
        if (!isNaN(w)) workers = w;
      }
      break;
    }
    return { queueCap: cap, workers: workers };
  }

  /** Per-file / operator slugs for expanded indexer Summary (service + run cards). */
  function indexerStructuredRollupCounts(entries) {
    var upload = 0,
      ingested = 0,
      skipped = 0,
      failed = 0,
      retry = 0,
      paused = 0,
      snapshots = 0;
    var relSet = {};
    var workers = null;
    var queueDepth = null;
    for (var i = 0; i < entries.length; i++) {
      var f = getFlat(entries[i].parsed);
      var m = indexerFlatMsg(f);
      if (m === "chimera-indexer.job.upload") {
        upload++;
        if (f.rel) relSet[String(f.rel)] = 1;
      } else if (m === "chimera-indexer.job.ingested" || m === "ingested") {
        ingested++;
        if (f.rel) relSet[String(f.rel)] = 1;
      } else if (m === "chimera-indexer.job.skipped") {
        skipped++;
        if (f.rel) relSet[String(f.rel)] = 1;
      } else if (m.indexOf("chimera-indexer.job.failed") === 0) failed++;
      else if (m.indexOf("chimera-indexer.retry") === 0) retry++;
      else if (m.indexOf("chimera-indexer.worker.paused") === 0) paused++;
      else if (m.indexOf("chimera-indexer.queue.snapshot") === 0) snapshots++;
    }
    for (var j = entries.length - 1; j >= 0; j--) {
      var fj = getFlat(entries[j].parsed);
      var mj = indexerFlatMsg(fj);
      if (mj.indexOf("chimera-indexer.queue.snapshot") === 0) {
        if (fj.workers != null && fj.workers !== "") workers = Number(fj.workers);
        if (fj.queue_depth != null && fj.queue_depth !== "") queueDepth = Number(fj.queue_depth);
        break;
      }
    }
    return {
      upload: upload,
      ingested: ingested,
      skipped: skipped,
      failed: failed,
      retry: retry,
      paused: paused,
      snapshots: snapshots,
      uniqRel: Object.keys(relSet).length,
      workers: workers,
      queueDepth: queueDepth
    };
  }

  function indexerStructuredRollupMiniHtml(entries) {
    var r = indexerStructuredRollupCounts(entries);
    var sk = formatInt(r.skipped);
    var ig = formatInt(r.ingested);
    var up = formatInt(r.upload);
    var rt = formatInt(r.retry);
    var fa = formatInt(r.failed);
    var pu = formatInt(r.paused);
    return (
      '<div class="sum-mini-row">' +
      '<div class="sum-mini-card">Skipped (before upload)<strong>' +
      escapeHtml(sk) +
      '</strong></div>' +
      '<div class="sum-mini-card">Successfully ingested<strong>' +
      escapeHtml(ig) +
      '</strong></div>' +
      '<div class="sum-mini-card">Started upload<strong>' +
      escapeHtml(up) +
      "</strong></div></div>" +
      '<div class="sum-mini-row">' +
      '<div class="sum-mini-card">Retries<strong>' +
      escapeHtml(rt) +
      '</strong></div>' +
      '<div class="sum-mini-card">Failed<strong>' +
      escapeHtml(fa) +
      '</strong></div>' +
      '<div class="sum-mini-card">Worker pauses<strong>' +
      escapeHtml(pu) +
      "</strong></div></div>"
    );
  }

  /** Caption under aggregate indexer progress bar (sums scope rows across partitioned indexer cards). */
  function indexerAggregateBacklogCaption(sumRem, sumTot) {
    if (sumRem !== null && !isNaN(Number(sumRem)) && sumTot !== null && !isNaN(Number(sumTot)))
      return (
        formatInt(Math.round(Number(sumRem))) +
        " remaining of " +
        formatInt(Math.round(Number(sumTot))) +
        " total"
      );
    if (sumRem !== null && !isNaN(Number(sumRem)))
      return formatInt(Math.round(Number(sumRem))) + " remaining of — total";
    if (sumTot !== null && !isNaN(Number(sumTot)))
      return "— remaining of " + formatInt(Math.round(Number(sumTot))) + " total";
    return "";
  }

  /** Explains aggregate scope bar while buffers warm up vs when metrics are live. */
  function indexerAggregateProgressDetailText(agg) {
    if (!agg || !agg.anyRun) {
      return "No indexer scopes in the loaded log window — scroll for older lines or wait for indexer traffic.";
    }
    var hasRem = agg.sumRem !== null && !isNaN(Number(agg.sumRem));
    var hasTot = agg.sumTot !== null && !isNaN(Number(agg.sumTot));
    if (!hasRem && !hasTot && !agg.allDone) {
      return "Waiting for indexer.scope.status heartbeats with queue and workspace file totals…";
    }
    if (agg.allDone) {
      return "Tracked runs in view have finished; bar reflects combined scope status when present.";
    }
    if (hasRem && Number(agg.sumRem) === 0 && hasTot) {
      return "No pending ingest or fan-out rows for scopes in view — totals match workspace file counts.";
    }
    return "Enqueued + fan-out backlog vs total workspace files.";
  }

  /**
   * Sum pending ingest + fan-out rows and workspace file totals across indexer partition buckets
   * (same metadata as each per-scope indexer card).
   */
  function rollupIndexerAggregateScopeProgress(byRun, partitionRegistry) {
    var sumRem = 0;
    var sumTot = 0;
    var anyRem = false;
    var anyTot = false;
    var anyRun = false;
    var allDone = true;
    if (!byRun || typeof byRun !== "object") {
      return { sumRem: null, sumTot: null, allDone: false, anyRun: false };
    }
    var keys = Object.keys(byRun);
    for (var i = 0; i < keys.length; i++) {
      var run = byRun[keys[i]];
      if (!run || !run.events || !run.events.length) continue;
      anyRun = true;
      var pmeta = null;
      if (
        partitionRegistry &&
        globalThis.ChimeraLogs &&
        ChimeraLogs.Derive &&
        typeof ChimeraLogs.Derive.indexerPartitionMetaForRun === "function"
      ) {
        pmeta = ChimeraLogs.Derive.indexerPartitionMetaForRun(
          partitionRegistry,
          run.id,
          run.events,
          getFlat
        );
      }
      var meta = collectIndexerRunMeta(run.id, run.events, pmeta);
      meta = mergePersistedIndexerWatchRoots(meta, run.events, run.id);
      if (!meta.doneSeen) allDone = false;
      var qIng =
        meta.scopeQueueIngestPending != null && !isNaN(Number(meta.scopeQueueIngestPending))
          ? Number(meta.scopeQueueIngestPending)
          : null;
      var qFan =
        meta.scopeQueueFanoutPending != null && !isNaN(Number(meta.scopeQueueFanoutPending))
          ? Number(meta.scopeQueueFanoutPending)
          : null;
      var pRem = null;
      if (qIng != null || qFan != null) {
        pRem = (qIng != null ? qIng : 0) + (qFan != null ? qFan : 0);
      }
      var qTot =
        meta.scopeWorkspaceTotal != null && !isNaN(Number(meta.scopeWorkspaceTotal))
          ? Math.round(Number(meta.scopeWorkspaceTotal))
          : null;
      if (pRem !== null) {
        sumRem += pRem;
        anyRem = true;
      }
      if (qTot !== null) {
        sumTot += qTot;
        anyTot = true;
      }
    }
    return {
      sumRem: anyRem ? sumRem : null,
      sumTot: anyTot ? sumTot : null,
      allDone: anyRun && allDone,
      anyRun: anyRun
    };
  }

  function gatewayServicePanelMiniHtml(arr) {
    var M = {
      kv: {
        listening: "—",
        upstream: "—",
        config: "—",
        apiKeys: "—",
        apiKeysTint: "none",
        routingRules: "—",
        supervised: "—"
      },
      counters: {
        http2xx: 0,
        httpNot2xx: 0,
        http429: 0,
        chatReq: 0,
        chatResp: 0,
        chatErr: 0,
        ragQuery: 0,
        ragHit: 0,
        ragRetrieveErr: "",
        ingestOk: 0,
        ingestFail: 0
      }
    };
    if (globalThis.ChimeraLogs && ChimeraLogs.Derive && typeof ChimeraLogs.Derive.gatewayCardModel === "function") {
      M = ChimeraLogs.Derive.gatewayCardModel(arr, getFlat);
    }
    var kv = M.kv || {};
    var c = M.counters || {};
    var apiKeysOpen =
      kv.apiKeysTint === "error"
        ? '<dd class="gateway-kv-dd gateway-kv-dd--error">'
        : "<dd>";
    var ragSub = c.ragRetrieveErr
      ? c.ragRetrieveErr
      : "search lines vs per-hit vectors";
    var httpSub =
      c.http429 > 0
        ? formatInt(c.http2xx) +
          " ok · " +
          formatInt(c.httpNot2xx) +
          " fail · " +
          formatInt(c.http429) +
          "×429"
        : formatInt(c.http2xx) + " ok · " + formatInt(c.httpNot2xx) + " fail";
    return (
      '<dl class="indexer-run-kv indexer-run-kv--gateway-summary">' +
      "<dt>listening</dt><dd>" +
      escapeHtml(kv.listening || "—") +
      '</dd><dt>chimera-broker</dt><dd>' +
      escapeHtml(kv.broker || "—") +
      '</dd><dt>config</dt><dd>' +
      escapeHtml(kv.config || "—") +
      "</dd><dt>API keys</dt>" +
      apiKeysOpen +
      escapeHtml(kv.apiKeys || "—") +
      '</dd><dt>routing rules</dt><dd>' +
      escapeHtml(kv.routingRules || "—") +
      '</dd><dt>supervised</dt><dd>' +
      escapeHtml(kv.supervised || "—") +
      "</dd></dl>" +
      '<div class="gw-panel-timeline">' +
      '<div class="sum-section-label">Request timeline</div>' +
      '<p class="sum-timeline-caption muted">Segment width is the share of lines in this view for each kind.</p>' +
      timelineBarHtml(arr) +
      timelineLegendHtml() +
      "</div>" +
      '<div class="sum-mini-row">' +
      '<div class="sum-mini-card">HTTP (ok / fail)<strong>' +
      escapeHtml(formatInt(c.http2xx) + " / " + formatInt(c.httpNot2xx)) +
      '</strong><span class="sum-mini-sub">' +
      escapeHtml(httpSub) +
      '</span></div>' +
      '<div class="sum-mini-card">Chat (req → resp)<strong>' +
      escapeHtml(formatInt(c.chatReq) + " → " + formatInt(c.chatResp)) +
      '</strong><span class="sum-mini-sub">' +
      escapeHtml(formatInt(c.chatErr) + " relay errors") +
      '</span></div>' +
      '<div class="sum-mini-card">RAG (queries · hits)<strong>' +
      escapeHtml(formatInt(c.ragQuery) + " · " + formatInt(c.ragHit)) +
      '</strong><span class="sum-mini-sub">' +
      escapeHtml(ragSub) +
      '</span></div>' +
      '<div class="sum-mini-card">Ingest (ok / fail)<strong>' +
      escapeHtml(formatInt(c.ingestOk) + " / " + formatInt(c.ingestFail)) +
      '</strong><span class="sum-mini-sub">complete vs failed + chunked errors</span></div></div>'
    );
  }

  /** Gateway DEBUG traces for RAG (counts entire buffer — same window as service cards). */
  function rollupGatewayRagPipeline() {
    if (globalThis.ChimeraLogs && globalThis.ChimeraLogs.Derive && globalThis.ChimeraLogs.Derive.rollupGatewayRagPipeline) {
      return globalThis.ChimeraLogs.Derive.rollupGatewayRagPipeline(entryCache, function (p) { return getFlat(p); });
    }
    return { ragQuery: 0, ragEmbed: 0, ragHitLines: 0, embedMsSum: 0 };
  }

  function vectorstoreHttpPathRollup(arr) {
    if (globalThis.ChimeraLogs && globalThis.ChimeraLogs.Derive && globalThis.ChimeraLogs.Derive.vectorstoreHttpPathRollup) {
      return globalThis.ChimeraLogs.Derive.vectorstoreHttpPathRollup(arr, function (p) { return getFlat(p); });
    }
    return { searchN: 0, upsertN: 0, scrollN: 0 };
  }

  function vectorstoreServicePanelMiniHtml(arr) {
    var M = {
      version: "—",
      configuration: "—",
      mode: "—",
      tls: "—",
      tlsGrpc: "—",
      tlsInternal: "—",
      telemetry: "—",
      recovery: "—",
      restPort: null,
      grpcPort: null,
      collLoaded: 0,
      collTotal: 0,
      upsertOk: 0,
      upsertFail: 0,
      deleteOk: 0,
      deleteFail: 0,
      searchOk: 0,
      searchFail: 0
    };
    if (globalThis.ChimeraLogs && ChimeraLogs.Derive && typeof ChimeraLogs.Derive.vectorstoreCardModel === "function") {
      M = ChimeraLogs.Derive.vectorstoreCardModel(arr, getFlat, vectorstoreCollectionScopeLabelForLogs);
    }
    var ports = "—";
    if (M.restPort != null && M.grpcPort != null) ports = String(M.restPort) + " / " + String(M.grpcPort);
    else if (M.restPort != null) ports = String(M.restPort) + " / —";
    else if (M.grpcPort != null) ports = "— / " + String(M.grpcPort);
    var kv =
      '<dl class="indexer-run-kv indexer-run-kv--vectorstore-summary">' +
      "<dt>component</dt><dd>chimera-vectorstore</dd>" +
      '<dt>backend</dt><dd>Vectorstore (binary)</dd>' +
      "<dt>version</dt><dd>" +
      escapeHtml(M.version || "—") +
      '</dd><dt>configuration</dt><dd>' +
      escapeHtml(M.configuration || "—") +
      '</dd><dt>mode</dt><dd>' +
      escapeHtml(M.mode || "—") +
      '</dd><dt>TLS (REST)</dt><dd>' +
      escapeHtml(M.tls || "—") +
      '</dd><dt>TLS (gRPC)</dt><dd>' +
      escapeHtml(M.tlsGrpc || "—") +
      '</dd><dt>telemetry</dt><dd>' +
      escapeHtml(M.telemetry || "—") +
      '</dd><dt>recovery</dt><dd>' +
      escapeHtml(M.recovery || "—") +
      '</dd><dt>port (REST/gRPC)</dt><dd>' +
      escapeHtml(ports) +
      "</dd></dl>";
    return (
      kv +
      '<div class="sum-mini-row">' +
      '<div class="sum-mini-card">Collections<strong>' +
      escapeHtml(formatInt(M.collLoaded) + " / " + formatInt(M.collTotal)) +
      '</strong><span class="sum-mini-sub">loaded / total</span></div>' +
      '<div class="sum-mini-card">Upsert<strong>' +
      escapeHtml(formatInt(M.upsertOk) + " / " + formatInt(M.upsertFail)) +
      '</strong><span class="sum-mini-sub">success / fail (Not HTTP 200)</span></div>' +
      '<div class="sum-mini-card">Delete<strong>' +
      escapeHtml(formatInt(M.deleteOk) + " / " + formatInt(M.deleteFail)) +
      '</strong><span class="sum-mini-sub">success / fail</span></div>' +
      '<div class="sum-mini-card">Search<strong>' +
      escapeHtml(formatInt(M.searchOk) + " / " + formatInt(M.searchFail)) +
      '</strong><span class="sum-mini-sub">success / fail</span></div></div>'
    );
  }

  function chimeraBrokerServicePanelKvHtml(arr) {
    var M = {
      version: "—",
      configuration: "—",
      port: "—",
      auth: "—",
      mcp: "—",
      governance: "—",
      lastModel: "—"
    };
    if (globalThis.ChimeraLogs && ChimeraLogs.Derive && typeof ChimeraLogs.Derive.chimeraBrokerCardModel === "function") {
      var d = ChimeraLogs.Derive.chimeraBrokerCardModel(arr, function (p) { return getFlat(p); });
      if (d.version) M.version = d.version;
      if (d.configuration) M.configuration = d.configuration;
      if (d.port) M.port = d.port;
      if (d.auth) M.auth = d.auth;
      if (d.mcp) M.mcp = d.mcp;
      if (d.governance) M.governance = d.governance;
      if (d.lastModel) M.lastModel = chimeraBrokerShortModelLabel(d.lastModel);
    }
    return (
      '<dl class="indexer-run-kv indexer-run-kv--chimera-broker-summary">' +
      "<dt>component</dt><dd>chimera-broker</dd>" +
      '<dt>backend</dt><dd>Chimera Broker (binary)</dd>' +
      "<dt>version</dt><dd>" +
      escapeHtml(M.version) +
      '</dd><dt>configuration</dt><dd>' +
      escapeHtml(M.configuration) +
      '</dd><dt>port</dt><dd>' +
      escapeHtml(M.port) +
      '</dd><dt>auth</dt><dd>' +
      escapeHtml(M.auth) +
      '</dd><dt>MCP</dt><dd>' +
      escapeHtml(M.mcp) +
      '</dd><dt>governance</dt><dd>' +
      escapeHtml(M.governance) +
      '</dd><dt>last model</dt><dd>' +
      escapeHtml(M.lastModel) +
      "</dd></dl>"
    );
  }

  function flatLooksLikeIndexerRunStart(fl) {
    var m = indexerFlatMsg(fl);
    if (m === "chimera-indexer.run.start" || m === "chimera-indexer run start") return true;
    if (String(fl.service || "").toLowerCase() !== "indexer") return false;
    return fl.root_ids != null && (fl.roots != null || Array.isArray(fl.watch_root_paths));
  }

  function flatLooksLikeIndexerRunDone(fl) {
    var m = indexerFlatMsg(fl);
    if (m.indexOf("chimera-indexer.run.done") === 0) return true;
    if (m === "indexer run done" || m === "indexer run stopped") return true;
    return (
      String(fl.service || "").toLowerCase() === "chimera-indexer" &&
      fl.ingest_completed != null &&
      fl.mode != null &&
      String(fl.mode).trim() !== ""
    );
  }

  function flatLooksLikeIndexerRunProgress(fl) {
    var m = indexerFlatMsg(fl);
    if (m.indexOf("chimera-indexer.run.progress") === 0 || m === "chimera-indexer.run.progress") return true;
    if (m === "initial scan complete") return true;
    return fl.phase != null && String(fl.phase).trim() !== "" && fl.candidates_enqueued != null;
  }

  function flatLooksLikeIndexerJobIngested(fl) {
    var m = indexerFlatMsg(fl);
    if (String(fl.service || "").toLowerCase() !== "chimera-indexer") return false;
    if (m !== "chimera-indexer.job.ingested" && m !== "ingested") return false;
    return fl.chunks != null;
  }

  function indexerRecentEvalStatusForFlat(f) {
    var m = indexerFlatMsg(f);
    var rel = f && f.rel != null ? String(f.rel).trim() : "";
    if (!rel) return null;

    if (m === "chimera-indexer.scope.active_file") {
      return { rel: rel, st: "evaluating", cls: "sum-st-indexing", detail: "" };
    }
    if (m === "chimera-indexer.job.upload") {
      return { rel: rel, st: "uploading", cls: "sum-st-indexing", detail: "" };
    }
    if (m === "chimera-indexer.job.ingested" || m === "ingested") {
      var chunks = f && f.chunks != null && !isNaN(Number(f.chunks)) ? Math.round(Number(f.chunks)) : null;
      return {
        rel: rel,
        st: "ingested",
        cls: "sum-st-complete",
        detail: chunks != null ? formatInt(chunks) + " chunks" : ""
      };
    }
    if (m === "chimera-indexer.job.skipped") {
      var why = f && f.reason != null ? String(f.reason).replace(/\s+/g, " ").trim() : "";
      if (why.length > 80) why = why.slice(0, 78) + "…";
      return { rel: rel, st: "skipped", cls: "sum-st-complete", detail: why };
    }
    if (m.indexOf("chimera-indexer.job.failed") === 0) {
      var err = f && (f.err != null ? f.err : f.error != null ? f.error : "");
      var es = err != null ? String(err).replace(/\s+/g, " ").trim() : "";
      if (es.length > 80) es = es.slice(0, 78) + "…";
      return { rel: rel, st: "failed", cls: "sum-st-error", detail: es };
    }
    if (m.indexOf("chimera-indexer.retry") === 0) {
      return { rel: rel, st: "retrying", cls: "sum-st-monitor", detail: "" };
    }
    if (m === "rag.retrieve.source") {
      var srcHits =
        f && f.source_hits != null && !isNaN(Number(f.source_hits))
          ? Math.round(Number(f.source_hits))
          : null;
      return {
        rel: rel,
        st: "retrieved",
        cls: "sum-st-retrieved",
        detail: srcHits != null ? formatInt(srcHits) + " hits" : ""
      };
    }
    return null;
  }

  function buildIndexerRecentEvaluatedFilesHtml(evsScope, bucketId, maxItems, recentOpts) {
    recentOpts = recentOpts || {};
    var evs = Array.isArray(evsScope) ? evsScope : [];
    var seen = {};
    var rows = [];
    var want = maxItems != null && !isNaN(Number(maxItems)) ? Math.max(3, Math.min(60, Math.round(Number(maxItems)))) : 18;
    for (var i = evs.length - 1; i >= 0; i--) {
      var f = getFlat(evs[i].parsed);
      var st = indexerRecentEvalStatusForFlat(f);
      if (!st) continue;
      if (seen[st.rel]) continue;
      seen[st.rel] = true;
      var t = formatLogDateTimeLocal(evs[i].ts);
      rows.push({
        t: t || "—",
        rel: st.rel,
        st: st.st,
        cls: st.cls,
        detail: st.detail || ""
      });
      if (rows.length >= want) break;
    }

    if (recentOpts.omitWhenEmpty && !rows.length) {
      return "";
    }

    var sid = "ix-recent-" + strHash(String(bucketId || ""));
    var html =
      '<div class="sum-full-log indexer-recent-files" id="' + escapeHtml(sid) + '"><ul>';
    if (!rows.length) {
      html += '<li class="sum-ev-item muted">No file-level activity in the loaded window yet. Scroll up to load older lines.</li>';
    } else {
      for (var r = 0; r < rows.length; r++) {
        var it = rows[r];
        var lvlClass = "lvl-INFO";
        if (it.st === "failed") lvlClass = "lvl-ERROR";
        else if (it.st === "retrying" || it.st === "skipped") lvlClass = "lvl-WARN";
        else if (it.st === "evaluating" || it.st === "uploading") lvlClass = "lvl-DEBUG";
        else if (it.st === "retrieved") lvlClass = "lvl-INFO";
        html +=
          '<li class="sum-ev-item indexer-recent-row">' +
          '<span class="muted indexer-recent-time">' +
          escapeHtml(it.t) +
          "</span>" +
          '<span class="log-line-sum__lvl indexer-recent-op ' +
          escapeHtml(lvlClass) +
          '">' +
          escapeHtml(it.st) +
          "</span>" +
          '<code class="sum-mono-id indexer-recent-path">' +
          escapeHtml(it.rel) +
          "</code>" +
          (it.detail
            ? '<span class="muted indexer-recent-detail" title="' +
            escapeHtml(it.detail) +
            '">' +
            escapeHtml(it.detail) +
            "</span>"
            : '<span class="muted indexer-recent-detail"></span>') +
          "</li>";
      }
    }
    html += "</ul></div>";
    return html;
  }

  /** Rolls up indexer.run.start / progress / done / job lines for summarized cards. */
  function collectIndexerRunMeta(runId, evs, partitionMeta) {
    if (globalThis.ChimeraLogs && globalThis.ChimeraLogs.Derive && globalThis.ChimeraLogs.Derive.collectIndexerRunMeta) {
      return globalThis.ChimeraLogs.Derive.collectIndexerRunMeta(runId, evs, {
        getFlat: function (p) { return getFlat(p); },
        ctx.tokenLabelByTenant: ctx.tokenLabelByTenant,
        indexerFlatMsg: function (fl) { return indexerFlatMsg(fl); },
        flatLooksLikeIndexerRunStart: function (fl) { return flatLooksLikeIndexerRunStart(fl); },
        flatLooksLikeIndexerRunDone: function (fl) { return flatLooksLikeIndexerRunDone(fl); },
        flatLooksLikeIndexerRunProgress: function (fl) { return flatLooksLikeIndexerRunProgress(fl); },
        flatLooksLikeIndexerJobIngested: function (fl) { return flatLooksLikeIndexerJobIngested(fl); },
        partitionMeta: partitionMeta || undefined
      });
    }

    var start = null;
    for (var i = 0; i < evs.length; i++) {
      var fi = getFlat(evs[i].parsed);
      if (flatLooksLikeIndexerRunStart(fi)) {
        start = fi;
        break;
      }
    }
    var lastProg = null;
    var doneFlat = null;
    var doneSeen = false;
    var tenantId = "";
    for (var u = evs.length - 1; u >= 0; u--) {
      var fR = getFlat(evs[u].parsed);
      if (!tenantId && (fR.tenant_id || fR.tenant || fR.principal_id))
        tenantId = String(fR.tenant_id || fR.tenant || fR.principal_id || "").trim();
      if (!lastProg && flatLooksLikeIndexerRunProgress(fR)) lastProg = fR;
      if (flatLooksLikeIndexerRunDone(fR)) {
        doneSeen = true;
        if (!doneFlat) doneFlat = fR;
      }
    }
    var vectorsSum = 0;
    for (var j = 0; j < evs.length; j++) {
      var fj = getFlat(evs[j].parsed);
      if (flatLooksLikeIndexerJobIngested(fj)) {
        var cj = Number(fj.chunks);
        if (!isNaN(cj)) vectorsSum += cj;
      }
    }
    var lpEmb =
      lastProg &&
      (lastProg.chunks_embedded != null
        ? Number(lastProg.chunks_embedded)
        : lastProg.embedded_chunks != null
          ? Number(lastProg.embedded_chunks)
          : NaN);
    var vectorsStored = null;
    if (vectorsSum > 0) vectorsStored = vectorsSum;
    else if (!isNaN(lpEmb) && lpEmb > 0) vectorsStored = Math.round(lpEmb);

    var ok = 0;
    var fail = 0;
    if (doneFlat) {
      var oc = Number(doneFlat.ingest_completed);
      var fc = Number(doneFlat.ingest_failed_dropped);
      ok = !isNaN(oc) ? oc : 0;
      fail = !isNaN(fc) ? fc : 0;
    } else {
      for (var k = 0; k < evs.length; k++) {
        var fk = getFlat(evs[k].parsed);
        var mk = indexerFlatMsg(fk);
        if (mk === "chimera-indexer.job.ingested" || mk === "ingested") ok++;
        else if (mk === "chimera-indexer.job.failed" || mk.indexOf("ingest failed (dropped)") === 0) fail++;
      }
    }

    var ws = start && start.scope_workspace_id ? String(start.scope_workspace_id).trim() : "";
    var sp = start && start.scope_project_id ? String(start.scope_project_id).trim() : "";
    var ip = start && start.ingest_project ? String(start.ingest_project).trim() : "";
    var flavor = start && start.flavor_id ? String(start.flavor_id).trim() : "";

    for (var bx = 0; bx < evs.length; bx++) {
      var fb = getFlat(evs[bx].parsed);
      if (String(fb.service || "").toLowerCase() !== "indexer") continue;
      if (!ws && fb.scope_workspace_id) ws = String(fb.scope_workspace_id).trim();
      if (!sp && fb.scope_project_id) sp = String(fb.scope_project_id).trim();
      if (!ip && fb.ingest_project) ip = String(fb.ingest_project).trim();
      if (!flavor && fb.flavor_id) flavor = String(fb.flavor_id).trim();
    }

    var projectId = sp || ip || "—";
    var watchRootPathsFb = [];
    if (start && Array.isArray(start.watch_root_paths) && start.watch_root_paths.length) {
      watchRootPathsFb = start.watch_root_paths.map(function (p) {
        return String(p);
      });
    }
    var filepath = watchRootPathsFb.length ? watchRootPathsFb.join("\n") : "—";

    var userLab = tenantId ? ctx.tokenLabelByTenant[tenantId] || tenantId : "—";

    return {
      runId: runId,
      start: start,
      userLabel: userLab,
      tenantId: tenantId,
      workspaceId: ws || "—",
      projectId: projectId,
      flavorId: flavor || "—",
      filepath: filepath,
      watchRootPaths: watchRootPathsFb,
      doneSeen: doneSeen,
      doneFlat: doneFlat,
      lastProg: lastProg,
      vectorsStored: vectorsStored,
      okCount: ok,
      failCount: fail
    };
  }

  function convWindowMs(g) {
    var t0 = null;
    var t1 = null;
    for (var ti = 0; ti < g.events.length; ti++) {
      var ins = entryInstant({ ts: g.events[ti].ts });
      if (ins) {
        if (!t0 || ins.getTime() < t0.getTime()) t0 = ins;
        if (!t1 || ins.getTime() > t1.getTime()) t1 = ins;
      }
    }
    return t0 && t1 ? t1.getTime() - t0.getTime() : 0;
  }

  function renderExpandedConv(g) {
    var evs = g.events;
    var cardModel = conversationCardModelForGroup(evs);
    var ingestCount = 0;
    var ig;
    for (ig = 0; ig < evs.length; ig++) {
      if (evs[ig].convJoinTier === "ingest") ingestCount++;
    }
    var bar = timelineBarHtml(evs);
    var spanMs = convWindowMs({ events: evs });
    var met = scrapeConversationMetrics(evs);
    var tokLine = met.tok != null ? formatInt(met.tok) + " tok" : "—";
    var mini =
      '<div class="sum-mini-row">' +
      '<div class="sum-mini-card">Token count<strong>' +
      escapeHtml(tokLine) +
      '</strong></div><div class="sum-mini-card">Duration<strong>' +
      escapeHtml(humanDurationMs(spanMs)) +
      '</strong></div><div class="sum-mini-card">Vectors retrieved<strong>' +
      (met.vec != null ? escapeHtml(String(met.vec)) : "—") +
      "</strong></div></div>";
    var life = conversationLifecycleBarHtml(cardModel.progress, {});
    var chips = conversationCardChipsSummaryHtml(cardModel);
    var kvBlock = conversationCardKvHtml(cardModel);
    var ingestBlock = "";
    if (ingestCount > 0 && cardModel.ingestRunIds && cardModel.ingestRunIds.length) {
      ingestBlock =
        '<details class="sum-conv-ingest"><summary>' +
        escapeHtml(
          "Ingest · " +
            ingestCount +
            " line" +
            (ingestCount === 1 ? "" : "s") +
            " · runs " +
            cardModel.ingestRunIds.join(", ")
        ) +
        '</summary><p class="muted sum-conv-ingest-hint">Lines tagged <strong>ingest</strong> in the full log share <code>index_run_id</code> with this conversation.</p></details>';
    }
    var turnGroups = null;
    if (
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.conversationTurnGroupsForExpanded === "function"
    ) {
      turnGroups = ChimeraLogs.Derive.conversationTurnGroupsForExpanded(evs, getFlat);
    }
    var cardKey =
      Array.isArray(g.cids) && g.cids.length > 1
        ? g.pid + "\0" + g.cids.slice().sort().join("\0")
        : g.pid + "\0" + g.cid;
    var convScope = strHash(cardKey);
    var scrollTbodyId = "conv-log-" + convScope;
    var tbodyInner = sumEvlogBuildTbodyFromConvEvents(evs, turnGroups, convScope);
    var mc = sumEvlogCountWarnFailFromEntries(evs);
    var servicesStrip = serviceStripHtml(evs);
    var full =
      '<div class="sum-full-log sum-full-log--evlog">' +
      sumEvlogPanelHtml({
        scrollTbodyId: scrollTbodyId,
        warnN: mc.warn,
        failN: mc.fail,
        tbodyInnerHtml: tbodyInner,
        title: "Full event log",
        titleRightHtml: servicesStrip || ""
      }) +
      "</div>";
    var contextStrip = SHOW_CONV_EXPANDED_CONTEXT_STRIP ? contextGrowthStripHtml(evs) : "";
    return (
      '<div class="sum-body">' +
      '<div class="sum-section-label">Lifecycle</div>' +
      life +
      chips +
      kvBlock +
      mini +
      (contextStrip ? '<div class="sum-section-label">Context</div>' + contextStrip : "") +
      ingestBlock +
      full +
      "</div>"
    );
  }

  function buildConvCard(g) {
    var t1 = null;
    for (var ti = 0; ti < g.events.length; ti++) {
      var ins = entryInstant({ ts: g.events[ti].ts });
      if (ins && (!t1 || ins.getTime() > t1.getTime())) t1 = ins;
    }
    var cid = String(g.cid);
    var mergedN = Array.isArray(g.cids) ? g.cids.length : 1;
    var title = formatConversationCardTitle(g.pid, cid) + formatMergedConversationSubtitle(mergedN);
    var lastEv = g.events[g.events.length - 1];
    var sub =
      '<span class="sum-sub sum-sub--clamp">' +
      escapeHtml(primaryLogMessage(lastEv.parsed, lastEv.text)) +
      "</span>";
    var cardModel = conversationCardModelForGroup(g.events);
    var dur = humanDurationMs(convWindowMs(g));
    var st = conversationCardStatus(g, t1, cardModel);
    var cardKey =
      Array.isArray(g.cids) && g.cids.length > 1
        ? g.pid + "\0" + g.cids.slice().sort().join("\0")
        : g.pid + "\0" + g.cid;
    var cardId = strHash(cardKey);
    var ini = avatarInitials(ctx.tokenLabelByTenant[g.pid] || g.pid);
    var av = avatarHueClass(cardKey);
    var sumChips = conversationCardChipsSummaryHtml(cardModel);
    var metrics =
      '<span class="sum-metrics">' +
      '<span class="sum-metric">' +
      escapeHtml(dur) +
      "</span></span>";
    var lifeCompact = conversationLifecycleBarHtml(cardModel.progress, { compact: true });
    return (
      '<details class="sum-card sum-card--conversation" id="' +
      escapeHtml(cardId) +
      '"><summary>' +
      '<span class="sum-avatar ' +
      av +
      '">' +
      escapeHtml(ini) +
      "</span>" +
      '<span class="sum-main"><span class="sum-title">' +
      title +
      "</span>" +
      sub +
      (sumChips ? sumChips : "") +
      "</span>" +
      metrics +
      lifeCompact +
      '<span class="sum-status ' +
      st.cls +
      '">' +
      escapeHtml(st.st) +
      "</span>" +
      '<span class="sum-chev"></span></summary>' +
      renderExpandedConv(g) +
      "</details>"
    );
  }

  /** Display label for a supervised YAML root (no directory path). */
  function formatIndexerSupervisedRootLabel(row) {
    if (!row || typeof row !== "object") return "—";
    var proj = row.project_id != null ? String(row.project_id).trim() : "";
    var ws = row.workspace_id != null ? String(row.workspace_id).trim() : "";
    var flav = row.flavor_id != null ? String(row.flavor_id).trim() : "";
    var bits = [];
    if (proj) bits.push(proj);
    if (flav) bits.push(flav);
    if (ws) bits.push(ws);
    return bits.join(" · ") || "—";
  }

  function indexerWorkspaceCardHref(bucketId) {
    return "#ix-" + strHash(String(bucketId || ""));
  }

  function normalizeFlavorMatch(v) {
    if (v == null || v === "—") return "";
    return String(v).trim();
  }

  /**
   * One canonical key per operator-store workspace row id (flat roots vs nested workspaces,
   * JSON number vs string, leading zeros). Prevents duplicate managed WS cards for the same row.
   */
  function canonicalWorkspaceRowIdKey(raw) {
    if (raw == null || raw === "") return "";
    if (typeof raw === "number" && isFinite(raw)) {
      var tr = Math.trunc(raw);
      if (tr === raw || Math.abs(raw - tr) < 1e-9) return String(tr);
      return String(raw);
    }
    var s = String(raw).trim();
    if (!s) return "";
    if (/^\d+$/.test(s)) return String(parseInt(s, 10));
    return s;
  }

  function deriveNestedWorkspacesFromFlatRoots(roots) {
    if (!roots || !roots.length) return [];
    var byId = {};
    var i;
    for (i = 0; i < roots.length; i++) {
      var r = roots[i] || {};
      var widRaw =
        r.workspace_row_id != null && String(r.workspace_row_id).trim() !== ""
          ? String(r.workspace_row_id).trim()
          : r.workspace_id != null && String(r.workspace_id).trim() !== ""
            ? String(r.workspace_id).trim()
            : "";
      var wid = canonicalWorkspaceRowIdKey(widRaw);
      if (!wid) continue;
      if (!byId[wid]) {
        var idDisp = /^\d+$/.test(wid) ? parseInt(wid, 10) : wid;
        byId[wid] = {
          id: idDisp,
          project_id: r.project_id != null ? String(r.project_id).trim() : "",
          flavor_id: r.flavor_id != null ? String(r.flavor_id).trim() : "",
          paths: []
        };
      }
      var pth = r.path != null ? String(r.path).trim() : "";
      if (!pth) continue;
      var pid =
        r.path_id != null && String(r.path_id).trim() !== "" ? String(r.path_id).trim() : "";
      byId[wid].paths.push(pid ? { id: pid, path: pth } : { path: pth });
    }
    var out = [];
    for (var k in byId) {
      if (Object.prototype.hasOwnProperty.call(byId, k)) out.push(byId[k]);
    }
    out.sort(function (a, b) {
      return Number(a.id) - Number(b.id);
    });
    return dedupeOperatorWorkspacesNested(out);
  }

  /** Stable list by workspace row id — API hydrate / merges must not accumulate duplicate ids. */
  function dedupeOperatorWorkspacesNested(arr) {
    if (!arr || !arr.length) return [];
    var seen = Object.create(null);
    var out = [];
    var i;
    for (i = 0; i < arr.length; i++) {
      var w = arr[i];
      if (!w || w.id == null) continue;
      var k = canonicalWorkspaceRowIdKey(w.id);
      if (!k || seen[k]) continue;
      seen[k] = true;
      out.push(w);
    }
    return out;
  }

  function mergeWorkspaceIntoOperatorNested(ws) {
    if (!ws || ws.id == null) return;
    var wid = canonicalWorkspaceRowIdKey(ws.id);
    if (!wid) return;
    var arr = ctx.lastIndexerOperatorWorkspacesNested.slice();
    var replaced = false;
    var ii;
    for (ii = 0; ii < arr.length; ii++) {
      if (canonicalWorkspaceRowIdKey(arr[ii].id) === wid) {
        arr[ii] = ws;
        replaced = true;
        break;
      }
    }
    if (!replaced) arr.push(ws);
    ctx.lastIndexerOperatorWorkspacesNested = dedupeOperatorWorkspacesNested(arr);
  }

  function syncIndexerOperatorPayloadFromConfigJson(d) {
    if (!d || typeof d !== "object") return;
    var roots = Array.isArray(d.roots) ? d.roots : [];
    ctx.lastIndexerOperatorRoots = roots;
    try {
      ctx.lastIndexerOperatorRootsJson = JSON.stringify(roots);
    } catch (_eSyn) {
      ctx.lastIndexerOperatorRootsJson = "";
    }
    if (Array.isArray(d.workspaces) && d.workspaces.length) {
      var seenWs = {};
      var uniqWs = [];
      var wi;
      for (wi = 0; wi < d.workspaces.length; wi++) {
        var ww = d.workspaces[wi];
        if (!ww || ww.id == null) continue;
        var wkey = canonicalWorkspaceRowIdKey(ww.id);
        if (!wkey) continue;
        if (seenWs[wkey]) {
          var u;
          for (u = 0; u < uniqWs.length; u++) {
            if (canonicalWorkspaceRowIdKey(uniqWs[u].id) === wkey) {
              mergeOperatorWorkspacePathsInto(uniqWs[u], ww);
              break;
            }
          }
          continue;
        }
        seenWs[wkey] = true;
        uniqWs.push(ww);
      }
      ctx.lastIndexerOperatorWorkspacesNested = dedupeOperatorWorkspacesNested(
        uniqWs.length ? uniqWs : deriveNestedWorkspacesFromFlatRoots(roots)
      );
    } else {
      ctx.lastIndexerOperatorWorkspacesNested = dedupeOperatorWorkspacesNested(
        deriveNestedWorkspacesFromFlatRoots(roots)
      );
    }
  }

  function indexerOperatorWorkspaceCardHrefByRowId(wsRowId) {
    return "#ix-opws-" + strHash(String(wsRowId || ""));
  }

  function resolveLogsOperatorUserLabel() {
    var z = ctx.tokenLabelByTenant[""];
    if (z != null && String(z).trim() !== "") return String(z).trim();
    var ks = Object.keys(ctx.tokenLabelByTenant);
    for (var i = 0; i < ks.length; i++) {
      var v = ctx.tokenLabelByTenant[ks[i]];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
    return "—";
  }

  /** Same title line as IX / stale / managed WS cards (em dash segments). */
  function workspaceCardTitleFromIndexerMeta(meta) {
    var userLine =
      meta.userLabel && meta.userLabel !== "—" ? String(meta.userLabel).trim() : "—";
    var prLine =
      meta.projectId && meta.projectId !== "—" ? String(meta.projectId).trim() : "—";
    var flavLine =
      meta.flavorId && meta.flavorId !== "—" ? String(meta.flavorId).trim() : "";
    return flavLine !== ""
      ? userLine + " — " + prLine + " — " + flavLine
      : userLine + " — " + prLine;
  }

  /** Same headline as buildIndexerOperatorWorkspaceCard — collapse duplicate DB rows. */
  function operatorManagedWorkspaceTitleText(ws) {
    var fv =
      ws.flavor_id != null && String(ws.flavor_id).trim() !== ""
        ? String(ws.flavor_id).trim()
        : "—";
    return workspaceCardTitleFromIndexerMeta({
      userLabel: resolveLogsOperatorUserLabel(),
      projectId: ws.project_id != null ? String(ws.project_id).trim() : "—",
      flavorId: fv
    });
  }

  function workspaceDraftComparableManagedTitle(d) {
    if (!d) return "";
    var prLine = String(d.projectId != null ? d.projectId : "").trim();
    if (!prLine) return "";
    var fv =
      d.flavorId != null && String(d.flavorId).trim() !== ""
        ? String(d.flavorId).trim()
        : "—";
    return workspaceCardTitleFromIndexerMeta({
      userLabel: resolveLogsOperatorUserLabel(),
      projectId: prLine,
      flavorId: fv
    });
  }

  function operatorWorkspacePaths(ws) {
    var out = [];
    if (!ws || !Array.isArray(ws.paths)) return out;
    var pi;
    for (pi = 0; pi < ws.paths.length; pi++) {
      var row = ws.paths[pi] || {};
      var pth = row.path != null ? String(row.path).trim() : "";
      if (pth && out.indexOf(pth) < 0) out.push(pth);
    }
    return out;
  }

  function normalizeIndexerWatchPathForCompare(p) {
    return String(p || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/\/+$/, "")
      .toLowerCase();
  }

  function pathsSetEqualForIndexerRoots(a, b) {
    var ae = !a || !a.length;
    var be = !b || !b.length;
    if (ae && be) return true;
    if (ae || be) return false;
    var arrA = a.map(normalizeIndexerWatchPathForCompare).filter(Boolean);
    var arrB = b.map(normalizeIndexerWatchPathForCompare).filter(Boolean);
    arrA.sort();
    arrB.sort();
    return arrA.join("\u0000") === arrB.join("\u0000");
  }

  /** Append watched paths from duplicate API workspace rows sharing the same canonical row id. */
  function mergeOperatorWorkspacePathsInto(target, source) {
    if (!target || !source || !Array.isArray(source.paths)) return;
    if (!target.paths) target.paths = [];
    var seenPath = Object.create(null);
    var pi;
    for (pi = 0; pi < target.paths.length; pi++) {
      var rowT = target.paths[pi] || {};
      var pt = rowT.path != null ? String(rowT.path).trim() : "";
      if (pt) seenPath[normalizeIndexerWatchPathForCompare(pt)] = true;
    }
    for (pi = 0; pi < source.paths.length; pi++) {
      var rowS = source.paths[pi] || {};
      var pth = rowS.path != null ? String(rowS.path).trim() : "";
      if (!pth) continue;
      var nk = normalizeIndexerWatchPathForCompare(pth);
      if (seenPath[nk]) continue;
      seenPath[nk] = true;
      var pid = rowS.id != null && String(rowS.id).trim() !== "" ? String(rowS.id).trim() : "";
      target.paths.push(pid ? { id: pid, path: pth } : { path: pth });
    }
  }

  /** Match supervised YAML root row to a partitioned indexer bucket id (same scope as Workspaces cards). */
  function findIndexerBucketIdForSupervisedRoot(row, byRun, partitionRegistry) {
    if (!row || !byRun || typeof byRun !== "object") return "";
    var rp = row.project_id != null ? String(row.project_id).trim() : "";
    var rf = row.flavor_id != null ? String(row.flavor_id).trim() : "";
    var keys = Object.keys(byRun);
    for (var i = 0; i < keys.length; i++) {
      var run = byRun[keys[i]];
      if (!run || !run.events || !run.events.length) continue;
      var pmeta = null;
      if (
        partitionRegistry &&
        globalThis.ChimeraLogs &&
        ChimeraLogs.Derive &&
        typeof ChimeraLogs.Derive.indexerPartitionMetaForRun === "function"
      ) {
        pmeta = ChimeraLogs.Derive.indexerPartitionMetaForRun(
          partitionRegistry,
          run.id,
          run.events,
          getFlat
        );
      }
      var meta = collectIndexerRunMeta(run.id, run.events, pmeta);
      meta = mergePersistedIndexerWatchRoots(meta, run.events, run.id);
      var mp = meta.projectId && meta.projectId !== "—" ? String(meta.projectId).trim() : "";
      var mf = normalizeFlavorMatch(meta.flavorId);
      if (mp !== rp) continue;
      if (mf !== rf) continue;
      return run.id;
    }
    return "";
  }

  /** Alphabetical ordering for managed workspace rows (shared by log-derived list + API hydrate). */
  function sortIndexerManagedWorkspaceRows(rows) {
    if (!rows || !rows.length) return rows || [];
    rows.sort(function (a, b) {
      return String(a.label != null ? a.label : "").localeCompare(
        String(b.label != null ? b.label : ""),
        undefined,
        { sensitivity: "base", numeric: true }
      );
    });
    return rows;
  }

  function indexerManagedWorkspacesCommaLinksHtml(items) {
    if (!items || !items.length) return '<span class="muted">—</span>';
    var parts = [];
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var lab = it.label != null ? String(it.label) : "";
      var bid = it.bucketId != null ? String(it.bucketId) : "";
      var hrefExplicit = it.href != null ? String(it.href).trim() : "";
      var href = hrefExplicit;
      if (!href && bid) href = indexerWorkspaceCardHref(bid);
      if (!lab || lab === "—") continue;
      if (href) {
        parts.push(
          '<a class="sum-ext-link indexer-svc-ws-link" href="' +
          escapeHtml(href) +
          '">' +
          escapeHtml(lab) +
          "</a>"
        );
      } else {
        parts.push('<span class="indexer-svc-ws-plain">' + escapeHtml(lab) + "</span>");
      }
    }
    return parts.length ? parts.join(", ") : '<span class="muted">—</span>';
  }

  /**
   * Distinct scopes from partitioned indexer runs with links to matching Workspaces cards (fallback before API).
   */
  function aggregateIndexerManagedWorkspacesHtml(byRun, partitionRegistry) {
    var seen = {};
    var rows = [];
    if (!byRun || typeof byRun !== "object") {
      return '<span class="muted">—</span>';
    }
    var keys = Object.keys(byRun);
    for (var i = 0; i < keys.length; i++) {
      var run = byRun[keys[i]];
      if (!run || !run.events || !run.events.length) continue;
      var pmeta = null;
      if (
        partitionRegistry &&
        globalThis.ChimeraLogs &&
        ChimeraLogs.Derive &&
        typeof ChimeraLogs.Derive.indexerPartitionMetaForRun === "function"
      ) {
        pmeta = ChimeraLogs.Derive.indexerPartitionMetaForRun(
          partitionRegistry,
          run.id,
          run.events,
          getFlat
        );
      }
      var meta = collectIndexerRunMeta(run.id, run.events, pmeta);
      meta = mergePersistedIndexerWatchRoots(meta, run.events, run.id);
      var lab = indexerCardTitleSortLabel(meta);
      if (!lab || lab === "—") continue;
      if (seen[lab]) continue;
      seen[lab] = true;
      rows.push({ label: lab, bucketId: run.id });
    }
    sortIndexerManagedWorkspaceRows(rows);
    return indexerManagedWorkspacesCommaLinksHtml(rows);
  }

  /**
   * Supersedes workspace list with supervised YAML roots when available; sets config path from gateway.
   */
  function hydrateIndexerServiceSummaryFromApi() {
    var wsEl = document.getElementById("svc-indexer-summary-workspaces");
    var cfgEl = document.getElementById("svc-indexer-summary-config-path");
    if (!cfgEl && !wsEl) return;
    fetch("/api/ui/indexer/config", { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("bad status");
        return res.json();
      })
      .then(function (d) {
        var prevRootsJ = ctx.lastIndexerOperatorRootsJson;
        syncIndexerOperatorPayloadFromConfigJson(d);
        var nextRootsJ = ctx.lastIndexerOperatorRootsJson;
        var nextRoots = ctx.lastIndexerOperatorRoots;
        var prevHadRoots = prevRootsJ !== "" && prevRootsJ !== "[]";
        if (
          nextRootsJ !== prevRootsJ &&
          getViewMode() === "summarized" &&
          (nextRoots.length > 0 || prevHadRoots) &&
          !indexerOperatorRootsRefreshQueued
        ) {
          indexerOperatorRootsRefreshQueued = true;
          window.requestAnimationFrame(function () {
            indexerOperatorRootsRefreshQueued = false;
            refreshSummarizedPanel();
          });
        }
        if (cfgEl) {
          var pth = d.path != null ? String(d.path).trim() : "";
          cfgEl.innerHTML = pth
            ? "<code>" + escapeHtml(pth) + "</code>"
            : '<span class="muted">—</span>';
        }
        if (wsEl && Array.isArray(d.roots) && d.roots.length > 0) {
          var br = ctx.lastIndexerSummarizeByRun;
          var preg = ctx.lastIndexerSummarizePartitionRegistry;
          var rows = [];
          for (var ri = 0; ri < d.roots.length; ri++) {
            var rowR = d.roots[ri] || {};
            var bidR = findIndexerBucketIdForSupervisedRoot(rowR, br, preg);
            /** Operator-store shape: project · flavor · workspace row id (id last). Do not swap to log-card title (user · project · flavor) — that prepends user and drops the row id. */
            var labR = formatIndexerSupervisedRootLabel(rowR);
            var hrefR = "";
            if (!bidR) {
              var rowWs =
                rowR.workspace_row_id != null && String(rowR.workspace_row_id).trim() !== ""
                  ? String(rowR.workspace_row_id).trim()
                  : rowR.workspace_id != null && String(rowR.workspace_id).trim() !== ""
                    ? String(rowR.workspace_id).trim()
                    : "";
              if (rowWs) hrefR = indexerOperatorWorkspaceCardHrefByRowId(rowWs);
            }
            rows.push({ label: labR, bucketId: bidR, href: hrefR });
          }
          sortIndexerManagedWorkspaceRows(rows);
          wsEl.innerHTML = indexerManagedWorkspacesCommaLinksHtml(rows);
        }
      })
      .catch(function () {
        if (cfgEl) {
          cfgEl.innerHTML =
            '<span class="muted">Not available (supervised indexer config path not set)</span>';
        }
      });
  }

  function renderExpandedService(name, arr, svcCtx) {
    svcCtx = svcCtx || {};
    var isChimeraBroker = name === "chimera-broker";
    var evConv = [];
    for (var j = 0; j < arr.length; j++) {
      evConv.push({ parsed: arr[j].parsed, text: arr[j].text, ts: arr[j].ts, source: arr[j].source });
    }
    var timelineBlock = "";
    if (
      name !== "chimera-indexer" &&
      name !== "chimera-vectorstore" &&
      name !== "chimera-broker" &&
      name !== "chimera-gateway"
    ) {
      timelineBlock = '<div class="sum-section-label">Request timeline</div>' + timelineBarHtml(evConv);
    }
    var aggregateIndexerProgressBlock = "";
    if (name === "chimera-indexer") {
      var aggIx = rollupIndexerAggregateScopeProgress(svcCtx.byRun, svcCtx.partitionRegistry);
      var aggCap = indexerAggregateBacklogCaption(aggIx.sumRem, aggIx.sumTot);
      var aggDetail = indexerAggregateProgressDetailText(aggIx);
      var aggCaptionRow =
        '<div class="indexer-aggregate-caption-row">' +
        (aggCap !== ""
          ? '<span class="indexer-scope-caption">' + escapeHtml(aggCap) + "</span>"
          : "") +
        '<span class="indexer-aggregate-progress-detail muted">' +
        escapeHtml(aggDetail) +
        "</span></div>";
      aggregateIndexerProgressBlock =
        '<div class="indexer-aggregate-progress-wrap">' +
        '<div class="sum-section-label sum-section-label--indexer-progress">' +
        escapeHtml("Progress (all indexers)") +
        "</div>" +
        '<div class="indexer-scope-progress indexer-scope-progress--aggregate" title="Sum of pending ingest + fan-out rows vs workspace files across all indexer scopes (from indexer.scope.status)">' +
        indexerScopeProgressTimelineBarHtml(aggIx.sumRem, aggIx.sumTot, aggIx.allDone) +
        aggCaptionRow +
        "</div></div>";
    }
    var indexerSummaryKv = "";
    if (name === "chimera-indexer") {
      indexerSummaryKv =
        buildIndexerCardIntroHtml() +
        '<dl class="indexer-run-kv indexer-run-kv--service-aggregate">' +
        "<dt>Managed workspaces</dt><dd id=\"svc-indexer-summary-workspaces\">" +
        aggregateIndexerManagedWorkspacesHtml(svcCtx.byRun, svcCtx.partitionRegistry) +
        '</dd><dt>Indexer config file</dt><dd id="svc-indexer-summary-config-path"><span class="muted">Loading…</span></dd>' +
        "</dl>";
    }
    var mini;
    if (isChimeraBroker) {
      var bx = chimeraBrokerCardMetrics(arr);
      var kvB = chimeraBrokerServicePanelKvHtml(arr);
      var tokLineB = "— → —";
      if (bx.outgoingSum > 0 || bx.usageSum > 0) {
        tokLineB =
          (bx.outgoingSum > 0 ? formatInt(Math.round(bx.outgoingSum)) : "—") +
          " → " +
          (bx.usageSum > 0 ? formatInt(Math.round(bx.usageSum)) : "—");
      }
      var rlBox = bx.rateLimitBoxN != null ? bx.rateLimitBoxN : 0;
      var fbBox = bx.fallbackN != null ? bx.fallbackN : 0;
      var availModelsStr =
        bx.catalogModelCount != null && bx.catalogModelCount > 0 ? formatInt(bx.catalogModelCount) : "—";
      var providerHealthStrip = chimeraBrokerProviderHealthStripHtml(arr);
      var relayOutcomeStrip = chimeraBrokerRelayOutcomeStripHtml(arr);
      mini =
        buildBrokerCardIntroHtml() +
        '<div class="sum-section-label">Provider health</div>' +
        providerHealthStrip +
        '<div class="sum-mini-row sum-mini-row--chimera-broker-deck">' +
        '<div class="sum-mini-card">Available models<strong>' +
        escapeHtml(availModelsStr) +
        '</strong><span class="sum-mini-sub">Count from latest chimera-broker catalog sync log (when backend reports a numeric total)</span></div>' +
        "</div>" +
        kvB +
        '<div class="sum-section-label">Relay outcomes</div>' +
        relayOutcomeStrip +
        '<div class="sum-mini-row sum-mini-row--chimera-broker-deck2">' +
        '<div class="sum-mini-card">Relay (ok / fail)<strong>' +
        escapeHtml(formatInt(bx.relayOk) + " / " + formatInt(bx.relayFail)) +
        '</strong><span class="sum-mini-sub">Successful upstream responses vs errors (gateway relay)</span></div>' +
        '<div class="sum-mini-card">Tokens (out → usage)<strong>' +
        escapeHtml(tokLineB) +
        "</strong>" +
        '<span class="sum-mini-sub">Prompt tokens sent vs completion usage from upstream JSON</span></div>' +
        '<div class="sum-mini-card">Rate limits<strong>' +
        escapeHtml(formatInt(rlBox)) +
        '</strong><span class="sum-mini-sub">Throttling / HTTP 429 (broker HTTP + chat relay)</span></div>' +
        '<div class="sum-mini-card">Routing fallback<strong>' +
        escapeHtml(formatInt(fbBox)) +
        '</strong><span class="sum-mini-sub">Virtual model fallback attempts (gateway)</span></div>' +
        '</div>';
    } else if (name === "chimera-indexer") {
      mini = indexerStructuredRollupMiniHtml(arr);
    } else if (name === "chimera-gateway") {
      mini = buildGatewayCardIntroHtml() + gatewayServicePanelMiniHtml(arr);
    } else if (name === "chimera-vectorstore") {
      mini = buildVectorstoreCardIntroHtml() + vectorstoreServicePanelMiniHtml(arr);
    } else {
      var httpN2 = 0,
        sumMs2 = 0,
        err2 = countWarnErrorInEntries(arr);
      for (var k2 = 0; k2 < arr.length; k2++) {
        if (arr[k2].parsed.shape === "http.access") {
          httpN2++;
          var rt2 = Number(getFlat(arr[k2].parsed).responseTimeMs);
          if (!isNaN(rt2)) sumMs2 += rt2;
        }
      }
      mini =
        '<div class="sum-mini-row">' +
        '<div class="sum-mini-card">Lines<strong>' +
        escapeHtml(String(arr.length)) +
        '</strong></div><div class="sum-mini-card">HTTP · Σ ms<strong>' +
        escapeHtml(formatInt(httpN2) + " · " + (httpN2 ? String(Math.round(sumMs2)) : "—")) +
        '</strong></div><div class="sum-mini-card">Warn+error lines<strong>' +
        escapeHtml(String(err2)) +
        "</strong></div></div>";
    }
    var fullLogClass = isChimeraBroker
      ? "sum-full-log sum-full-log--chimera-broker sum-full-log--evlog"
      : "sum-full-log sum-full-log--evlog";
    var scrollTbodyId = "svc-log-" + strHash(name);
    var cardScope = strHash("svc:" + name);
    var visEnt = sumEvlogVisibleEntriesForService(name, arr, name === "chimera-gateway");
    var mc = sumEvlogCountWarnFailFromEntries(visEnt);
    var tbodyInner = sumEvlogBuildTbodyFromServiceEntries(name, arr, {
      cardScope: cardScope,
      filterGatewayProbe: name === "chimera-gateway"
    });
    var full =
      '<div class="' + fullLogClass + '">' +
      sumEvlogPanelHtml({
        scrollTbodyId: scrollTbodyId,
        warnN: mc.warn,
        failN: mc.fail,
        tbodyInnerHtml: tbodyInner,
        title: "Full event log"
      }) +
      "</div>";
    return (
      '<div class="sum-body">' +
      timelineBlock +
      '<div class="sum-section-label">Summary</div>' +
      indexerSummaryKv +
      aggregateIndexerProgressBlock +
      mini +
      full +
      "</div>"
    );
  }

  function serviceAvatarClass(name) {
    switch (name) {
      case "chimera-gateway":
        return "sum-av-svc-chimera-gateway";
      case "chimera-broker":
        return "sum-av-svc-chimera-broker";
      case "chimera-vectorstore":
        return "sum-av-svc-chimera-vectorstore";
      case "chimera-indexer":
        return "sum-av-svc-chimera-indexer";
      default:
        return avatarHueClass(name);
    }
  }

  function serviceAvatarInitials(name) {
    switch (name) {
      case "chimera-broker":
        return "CB";
      case "chimera-gateway":
        return "CW";
      case "chimera-vectorstore":
        return "CV";
      case "chimera-indexer":
        return "CI";
      default:
        return avatarInitials(name);
    }
  }

  function buildServiceCard(name, arr, svcCtx) {
    svcCtx = svcCtx || {};
    var httpN = 0;
    var sumMs = 0;
    for (var k = 0; k < arr.length; k++) {
      var p = arr[k].parsed;
      if (p.shape === "http.access") {
        httpN++;
        var rt = Number(getFlat(p).responseTimeMs);
        if (!isNaN(rt)) sumMs += rt;
      }
    }
    var isChimeraBroker = name === "chimera-broker";
    var gwCardModel = null;
    if (
      name === "chimera-gateway" &&
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.gatewayCardModel === "function"
    ) {
      gwCardModel = ChimeraLogs.Derive.gatewayCardModel(arr, getFlat);
    }
    var qdrCardModel = null;
    if (
      name === "chimera-vectorstore" &&
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.vectorstoreCardModel === "function"
    ) {
      vCardModel = ChimeraLogs.Derive.vectorstoreCardModel(arr, getFlat, vectorstoreCollectionScopeLabelForLogs);
    }
    var lastMsg = isChimeraBroker ? chimeraBrokerCollapsedCardSubtitle(arr) : "";
    if (!isChimeraBroker) {
      var last = arr.length ? arr[arr.length - 1] : null;
      if (last) lastMsg = primaryLogMessage(last.parsed, last.text);
      if (name === "chimera-vectorstore" && qdrCardModel && qdrCardModel.subtitle && qdrCardModel.subtitle !== "—") {
        lastMsg = qdrCardModel.subtitle;
      }
      if (name === "chimera-gateway" && gwCardModel && gwCardModel.subtitle && gwCardModel.subtitle !== "—") {
        lastMsg = gwCardModel.subtitle;
      }
    }
    var ixWaitFlat = name === "chimera-indexer" ? indexerLatestSupervisedWaitFlat(arr) : null;
    if (ixWaitFlat) {
      var ixWaitProse =
        globalThis.ChimeraLogs &&
          ChimeraLogs.Derive &&
          typeof ChimeraLogs.Derive.indexerProseSummary === "function"
          ? ChimeraLogs.Derive.indexerProseSummary(ixWaitFlat)
          : null;
      if (ixWaitProse && String(ixWaitProse).trim() !== "") lastMsg = String(ixWaitProse).trim();
    }
    var st;
    if (recentServiceCardHasError(name, arr)) {
      st = { st: "error", cls: "sum-st-error" };
    } else if (name === "chimera-gateway" && gwCardModel) {
      if (gwCardModel.cardStatus === "error") st = { st: "error", cls: "sum-st-error" };
      else if (gwCardModel.cardStatus === "warn") st = { st: "degraded", cls: "sum-st-monitor" };
      else st = { st: "active", cls: "sum-st-active" };
    } else if (ixWaitFlat) {
      st = { st: "idle", cls: "sum-st-monitor" };
    } else {
      st = { st: "active", cls: "sum-st-active" };
    }
    var sid = "svc-" + strHash(name);
    var ini = serviceAvatarInitials(name);
    var av = serviceAvatarClass(name);
    /** Single outer .sum-title only — avoid nesting .sum-title (was hiding pills / breaking layout). */
    var titleClass = "sum-title";
    var displayServiceName = name;
    var titleBlock = escapeHtml(displayServiceName);
    var chimeraBrokerCompactHealth = isChimeraBroker ? chimeraBrokerProviderHealthStripHtml(arr, { compact: true }) : "";
    var wms = serviceWindowMs(arr);
    var metrics;
    if (isChimeraBroker) {
      var bxC = chimeraBrokerCardMetrics(arr);
      var pill1 = formatInt(bxC.relayOk) + " ok · " + formatInt(bxC.relayFail) + " fail";
      var rlb = bxC.rateLimitBoxN != null ? bxC.rateLimitBoxN : 0;
      var fbb = bxC.fallbackN != null ? bxC.fallbackN : 0;
      var pill3 = formatInt(rlb) + " rate-limit · " + formatInt(fbb) + " fallback";
      if (pill3.length > 36) pill3 = pill3.slice(0, 34) + "…";
      metrics =
        '<span class="sum-metrics">' +
        '<span class="sum-metric">' +
        escapeHtml(pill1) +
        '</span><span class="sum-metric">' +
        escapeHtml(pill3) +
        "</span></span>";
    } else if (name === "chimera-vectorstore") {
      if (vectorstoreCardModel) {
        var vm = vectorstoreCardModel;
        var vColsPill = formatInt(vm.collLoaded || 0) + " / " + formatInt(vm.collTotal || 0);
        var vUpPill = formatInt(vm.upsertOk || 0) + " ok · " + formatInt(vm.upsertFail || 0) + " fail";
        var vSrPill = formatInt(vm.searchOk || 0) + " ok · " + formatInt(vm.searchFail || 0) + " fail";
        metrics =
          '<span class="sum-metrics">' +
          '<span class="sum-metric" title="Collections loaded / total (lines since last chimera-vectorstore.version)">' +
          'Collections ' +
          escapeHtml(vColsPill) +
          '</span><span class="sum-metric" title="Points upsert: HTTP 200 vs rejected / non-200">' +
          'Upserts ' +
          escapeHtml(vUpPill) +
          '</span><span class="sum-metric" title="Vector search: HTTP 200 vs fail">' +
          'Searches ' +
          escapeHtml(vSrPill) +
          "</span></span>";
      } else {
        metrics = "";
      }
    } else if (name === "chimera-gateway") {
      if (gwCardModel) {
        var gc = gwCardModel.counters || {};
        var httpPill =
          formatInt(gc.http2xx || 0) + " ok · " + formatInt(gc.httpNot2xx || 0) + " fail";
        if (gc.http429 > 0) {
          httpPill += " · " + formatInt(gc.http429) + " rate-limited";
        }
        var chatPill =
          "chat " +
          formatInt(gc.chatReq || 0) +
          " reqs → " +
          formatInt(gc.chatResp || 0) +
          " resps · " +
          formatInt(gc.chatErr || 0) +
          " errs";
        metrics =
          '<span class="sum-metrics">' +
          '<span class="sum-metric" title="HTTP 2xx vs non-2xx (gateway.http.access in this buffer window)">' +
          escapeHtml(httpPill) +
          '</span><span class="sum-metric" title="chat.request vs chat.chimera-broker.response vs chat.chimera-broker.error">' +
          escapeHtml(chatPill) +
          "</span></span>";
      } else {
        metrics = "";
      }
    } else if (name === "chimera-indexer") {
      var qiIx = latestIndexerStateQueueInflightFromEntries(arr);
      var snapIx = latestIndexerQueueSnapshotMetaFromEntries(arr);
      var ixPills = "";
      if (qiIx.queueDepth != null && !isNaN(Number(qiIx.queueDepth))) {
        var qCur = formatInt(Math.round(Number(qiIx.queueDepth)));
        var qMax =
          snapIx.queueCap != null && !isNaN(Number(snapIx.queueCap))
            ? formatInt(Math.round(Number(snapIx.queueCap)))
            : "—";
        ixPills +=
          '<span class="sum-metric" title="Queue depth vs max (queue_depth / queue_cap)">' +
          escapeHtml("Queue " + qCur + " / " + qMax) +
          "</span>";
      }
      if (qiIx.ingestInflight != null && !isNaN(Number(qiIx.ingestInflight))) {
        var iCur = formatInt(Math.round(Number(qiIx.ingestInflight)));
        var iWorkers =
          snapIx.workers != null && !isNaN(Number(snapIx.workers))
            ? formatInt(Math.round(Number(snapIx.workers)))
            : "—";
        ixPills +=
          '<span class="sum-metric" title="In-flight ingests vs worker pool (ingest_inflight / workers)">' +
          escapeHtml(iCur + " inflight / " + iWorkers + " workers") +
          "</span>";
      }
      metrics = '<span class="sum-metrics">' + ixPills + "</span>";
    } else {
      metrics =
        '<span class="sum-metrics">' +
        '<span class="sum-metric">' +
        escapeHtml(String(arr.length)) +
        ' lines</span>' +
        (httpN ? '<span class="sum-metric">' + escapeHtml(String(httpN)) + " http</span>" : "") +
        (sumMs ? '<span class="sum-metric">' + escapeHtml(humanDurationMs(sumMs)) + " Σ</span>" : "") +
        "</span>";
    }
    return (
      '<details class="sum-card" id="' +
      escapeHtml(sid) +
      '"><summary>' +
      '<span class="sum-avatar ' +
      av +
      '">' +
      escapeHtml(ini) +
      "</span>" +
      '<span class="sum-main"><span class="' +
      titleClass +
      '">' +
      titleBlock +
      '</span><span class="sum-sub sum-sub--clamp">' +
      escapeHtml(lastMsg) +
      "</span></span>" +
      metrics +
      chimeraBrokerCompactHealth +
      '<span class="sum-status ' +
      st.cls +
      '">' +
      escapeHtml(st.st) +
      "</span>" +
      '<span class="sum-chev"></span></summary>' +
      renderExpandedService(name, arr, svcCtx) +
      "</details>"
    );
  }

  /** dt/dd fragment for expanded indexer Summary: user, project, flavor, optional workspace row id, file count. Joined into one indexer-run-kv with Watched paths. */
  function indexerExpandedSummaryKvInnerHtml(meta, kvOpts) {
    kvOpts = kvOpts || {};
    var sumU = meta.userLabel && meta.userLabel !== "—" ? String(meta.userLabel).trim() : "—";
    var sumP = meta.projectId && meta.projectId !== "—" ? String(meta.projectId).trim() : "—";
    var sumF = meta.flavorId && meta.flavorId !== "—" ? String(meta.flavorId).trim() : "";
    var flavStrong =
      sumF !== "" ? escapeHtml(sumF) : '<span class="muted">\u2014</span>';
    var wsRow = "";
    var wsLab = kvOpts.workspaceRowId != null ? String(kvOpts.workspaceRowId).trim() : "";
    if (wsLab) {
      wsRow = "<dt>Workspace ID</dt><dd>" + escapeHtml(wsLab) + "</dd>";
    }
    var fcTot =
      meta.scopeWorkspaceTotal != null && !isNaN(Number(meta.scopeWorkspaceTotal))
        ? Math.round(Number(meta.scopeWorkspaceTotal))
        : null;
    var fileRow = "";
    if (!kvOpts.omitFileCountIfZero || (fcTot != null && fcTot > 0)) {
      var fileCountStrong =
        fcTot != null
          ? escapeHtml(formatInt(fcTot))
          : '<span class="muted">\u2014</span>';
      fileRow = "<dt>File count</dt><dd>" + fileCountStrong + "</dd>";
    }
    return (
      "<dt>User name</dt><dd>" +
      escapeHtml(sumU) +
      "</dd>" +
      "<dt>Project ID</dt><dd>" +
      escapeHtml(sumP) +
      "</dd>" +
      "<dt>Flavor ID</dt><dd>" +
      flavStrong +
      "</dd>" +
      wsRow +
      fileRow
    );
  }

  function renderExpandedIndexer(run, evs, meta, partitionRegistry, expOpts) {
    expOpts = expOpts || {};
    var kvOpts = expOpts.kvOpts || {};
    var pathsBlock =
      expOpts.pathsBlockHtml != null
        ? String(expOpts.pathsBlockHtml)
        : meta.watchRootPaths && meta.watchRootPaths.length
          ? "<pre class=\"indexer-paths-pre\">" +
          escapeHtml(meta.watchRootPaths.join("\n")) +
          "</pre>"
          : '<span class="muted">—</span>';
    var summaryRows =
      '<dl class="indexer-run-kv">' +
      indexerExpandedSummaryKvInnerHtml(meta, kvOpts) +
      "<dt>Watched paths</dt><dd>" +
      pathsBlock +
      "</dd></dl>";
    var afterSummary = expOpts.extraAfterSummaryHtml != null ? String(expOpts.extraAfterSummaryHtml) : "";
    var evsFull = filterEventsForIndexerScopeFullLog(evs, run.id, partitionRegistry || {});
    var recentOpts = expOpts.recentOpts || {};
    var recentFiles = buildIndexerRecentEvaluatedFilesHtml(evsFull, run.id, 18, recentOpts);
    var recentSection = recentFiles
      ? '<div class="sum-section-label">Recently evaluated files</div>' + recentFiles
      : "";
    var fullId = "ix-full-" + strHash(run.id);
    var ixScope = strHash("ixrun:" + run.id);
    var tbodyInner;
    var mc;
    if (!evsFull.length) {
      tbodyInner =
        '<tr class="sum-evlog__row"><td colspan="3" class="muted">No scope-specific lines in the loaded window (shared lines appear under Services → Indexer).</td></tr>';
      mc = { warn: 0, fail: 0 };
    } else {
      tbodyInner = sumEvlogBuildTbodyFromServiceEntries("indexer", evsFull, {
        cardScope: ixScope,
        filterGatewayProbe: false,
        indexerRunLine: true
      });
      mc = sumEvlogCountWarnFailFromEntries(evsFull);
    }
    var full =
      '<div class="sum-full-log sum-full-log--evlog">' +
      sumEvlogPanelHtml({
        scrollTbodyId: fullId,
        warnN: mc.warn,
        failN: mc.fail,
        tbodyInnerHtml: tbodyInner,
        title: "Full event log"
      }) +
      "</div>";
    return (
      '<div class="sum-body">' +
      '<div class="sum-section-label">Summary</div>' +
      summaryRows +
      afterSummary +
      recentSection +
      full +
      "</div>"
    );
  }

  function loadIndexerWatchRootsStore() {
    try {
      var s = localStorage.getItem(INDEXER_WATCH_ROOTS_LS);
      if (!s) return { byBucket: {}, byRunId: {}, snapshots: {} };
      var o = JSON.parse(s);
      if (!o || typeof o !== "object") return { byBucket: {}, byRunId: {}, snapshots: {} };
      if (!o.byBucket || typeof o.byBucket !== "object") o.byBucket = {};
      if (!o.byRunId || typeof o.byRunId !== "object") o.byRunId = {};
      if (!o.snapshots || typeof o.snapshots !== "object") o.snapshots = {};
      return o;
    } catch (_e) {
      return { byBucket: {}, byRunId: {}, snapshots: {} };
    }
  }

  function saveIndexerWatchRootsStore(store) {
    try {
      localStorage.setItem(INDEXER_WATCH_ROOTS_LS, JSON.stringify(store));
    } catch (_e) {
      try {
        var st = loadIndexerWatchRootsStore();
        var keys = Object.keys(st.byBucket);
        keys.sort();
        for (var ki = 0; ki < Math.min(24, keys.length); ki++) delete st.byBucket[keys[ki]];
        localStorage.setItem(INDEXER_WATCH_ROOTS_LS, JSON.stringify(st));
      } catch (_e2) { }
    }
  }

  function latestIndexRunIdFromEvs(evs) {
    if (!evs || !evs.length) return "";
    for (var i = evs.length - 1; i >= 0; i--) {
      var f = getFlat(evs[i].parsed);
      var rid = f.index_run_id != null ? String(f.index_run_id).trim() : "";
      if (rid) return rid;
    }
    return "";
  }

  function indexerScopeKeyFromMetaAndEvs(meta, evs) {
    var p =
      meta.projectId && meta.projectId !== "—" ? String(meta.projectId).trim() : "";
    var fv =
      meta.flavorId && meta.flavorId !== "—" ? String(meta.flavorId).trim() : "";
    if (!p && evs && evs.length) {
      for (var j = evs.length - 1; j >= 0; j--) {
        var g = getFlat(evs[j].parsed);
        var ip = String(g.ingest_project || "").trim();
        if (ip) {
          p = ip;
          if (!fv && g.flavor_id != null) fv = String(g.flavor_id).trim();
          break;
        }
      }
    }
    if (!p) return "";
    return p + "\0" + fv;
  }

  /**
   * Collapse duplicate live Workspaces rows that refer to the same indexer partition (restart /
   * polling produced multiple bucket ids). Prefer workspace id, then indexer_target_key; otherwise
   * keep one card per distinct bucket id.
   */
  function indexerRunTimelineDedupeKey(meta, bucketId) {
    var ws =
      meta.workspaceId && meta.workspaceId !== "\u2014" && String(meta.workspaceId).trim() !== ""
        ? String(meta.workspaceId).trim()
        : "";
    if (ws) return "ws:" + ws;
    var itk =
      meta.indexerKey && String(meta.indexerKey).trim() !== ""
        ? String(meta.indexerKey).trim()
        : "";
    if (itk) return "itk:" + itk;
    var bid = String(bucketId || "").trim();
    return bid ? "bid:" + bid : "none";
  }

  /** When multiple byRun buckets share indexerRunTimelineDedupeKey, keep the richest card. */
  function pickCanonicalIndexerRun(runs) {
    if (!runs || !runs.length) return null;
    if (runs.length === 1) return runs[0];
    var best = runs[0];
    var bi;
    for (bi = 1; bi < runs.length; bi++) {
      var r = runs[bi];
      var lenR = (r && r.events && r.events.length) || 0;
      var lenB = (best && best.events && best.events.length) || 0;
      if (lenR > lenB) best = r;
    }
    return best;
  }

  /** Stable key for deduping indexer cards when bucket id (run.id) churns between polls. */
  function indexerCardIdentityKey(meta) {
    var userLine =
      meta.userLabel && meta.userLabel !== "—" ? String(meta.userLabel).trim() : "—";
    var prLine =
      meta.projectId && meta.projectId !== "—" ? String(meta.projectId).trim() : "—";
    var flavLine =
      meta.flavorId && meta.flavorId !== "—" ? String(meta.flavorId).trim() : "";
    return userLine + "\0" + prLine + "\0" + flavLine;
  }

  function indexerCardIdentityKeyFromSnap(sn) {
    var userLine =
      sn.userLabel && sn.userLabel !== "—" ? String(sn.userLabel).trim() : "—";
    var prLine =
      sn.projectId && sn.projectId !== "—" ? String(sn.projectId).trim() : "—";
    var flavLine =
      sn.flavorId && sn.flavorId !== "—" ? String(sn.flavorId).trim() : "";
    return userLine + "\0" + prLine + "\0" + flavLine;
  }

  /** Same headline as indexer cards; used for stable alphabetical ordering in the Workspaces section. */
  function indexerCardTitleSortLabel(o) {
    if (!o) return "—";
    var userLine =
      o.userLabel && o.userLabel !== "—" ? String(o.userLabel).trim() : "—";
    var prLine =
      o.projectId && o.projectId !== "—" ? String(o.projectId).trim() : "—";
    var flavLine =
      o.flavorId && o.flavorId !== "—" ? String(o.flavorId).trim() : "";
    return flavLine !== ""
      ? userLine + ":" + prLine + ":" + flavLine
      : userLine + ":" + prLine;
  }

  var vectorstoreScopeLabelMapCacheRun = null;
  var vectorstoreScopeLabelMapCachePreg = null;
  var vectorstoreScopeLabelMapCache = null;

  function buildVectorstoreCollectionScopeLabelMap() {
    var map = {};
    var byRun = ctx.lastIndexerSummarizeByRun;
    if (!byRun || typeof byRun !== "object") return map;
    var preg = ctx.lastIndexerSummarizePartitionRegistry;
    var keys = Object.keys(byRun);
    for (var i = 0; i < keys.length; i++) {
      var run = byRun[keys[i]];
      if (!run || !run.events || !run.events.length) continue;
      var pmeta = null;
      if (
        preg &&
        globalThis.ChimeraLogs &&
        ChimeraLogs.Derive &&
        typeof ChimeraLogs.Derive.indexerPartitionMetaForRun === "function"
      ) {
        pmeta = ChimeraLogs.Derive.indexerPartitionMetaForRun(preg, run.id, run.events, getFlat);
      }
      var meta = collectIndexerRunMeta(run.id, run.events, pmeta);
      meta = mergePersistedIndexerWatchRoots(meta, run.events, run.id);
      if (
        !globalThis.ChimeraLogs ||
        !ChimeraLogs.Derive ||
        typeof ChimeraLogs.Derive.vectorstoreCollectionNameFromIndexerMeta !== "function"
      )
        continue;
      var cn = ChimeraLogs.Derive.vectorstoreCollectionNameFromIndexerMeta(meta);
      if (!cn) continue;
      map[cn] = indexerCardTitleSortLabel(meta);
    }
    return map;
  }

  function vectorstoreCollectionScopeLabelForLogs(collRaw) {
    if (
      ctx.lastIndexerSummarizeByRun !== vectorstoreScopeLabelMapCacheRun ||
      ctx.lastIndexerSummarizePartitionRegistry !== vectorstoreScopeLabelMapCachePreg
    ) {
      vectorstoreScopeLabelMapCacheRun = ctx.lastIndexerSummarizeByRun;
      vectorstoreScopeLabelMapCachePreg = ctx.lastIndexerSummarizePartitionRegistry;
      vectorstoreScopeLabelMapCache = buildVectorstoreCollectionScopeLabelMap();
    }
    var c = String(collRaw != null ? collRaw : "").trim();
    if (!c) return c;
    var hit = vectorstoreScopeLabelMapCache && vectorstoreScopeLabelMapCache[c];
    return hit != null && String(hit).trim() !== "" ? String(hit).trim() : c;
  }

  function ragCollectionLabelForUi(collRaw) {
    var r = collRaw != null ? String(collRaw).trim() : "";
    if (!r) return "";
    if (
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.vectorstoreCollectionDisplay === "function"
    ) {
      var lab = ChimeraLogs.Derive.vectorstoreCollectionDisplay(r, vectorstoreCollectionScopeLabelForLogs);
      if (lab != null && String(lab).trim() !== "") return String(lab).trim();
    }
    return r;
  }

  function persistIndexerWatchRoots(paths, indexRunId, scopeKey, bucketId) {
    if (!paths || !paths.length) return;
    var store = loadIndexerWatchRootsStore();
    var t = Date.now();
    var copy = paths.map(function (x) {
      return String(x);
    });
    if (bucketId) {
      store.byBucket[bucketId] = {
        paths: copy,
        t: t,
        indexRunId: indexRunId || "",
        scopeKey: scopeKey || ""
      };
    }
    if (indexRunId) {
      store.byRunId[indexRunId] = { paths: copy, scopeKey: scopeKey || "", bucketId: bucketId || "", t: t };
    }
    saveIndexerWatchRootsStore(store);
  }

  /** Remember cards so indexers that fell out of the log buffer still appear (stale row). */
  function rememberIndexerCardSnapshot(bucketId, meta) {
    if (!bucketId || !meta) return;
    var store = loadIndexerWatchRootsStore();
    var idKey = indexerCardIdentityKey(meta);
    for (var sk in store.snapshots) {
      if (!Object.prototype.hasOwnProperty.call(store.snapshots, sk)) continue;
      if (sk === bucketId) continue;
      if (indexerCardIdentityKeyFromSnap(store.snapshots[sk]) === idKey) delete store.snapshots[sk];
    }
    store.snapshots[bucketId] = {
      userLabel: meta.userLabel != null ? String(meta.userLabel) : "—",
      projectId: meta.projectId != null ? String(meta.projectId) : "—",
      flavorId: meta.flavorId != null ? String(meta.flavorId) : "—",
      paths: meta.watchRootPaths && meta.watchRootPaths.length ? meta.watchRootPaths.slice() : [],
      t: Date.now()
    };
    var keys = Object.keys(store.snapshots);
    if (keys.length > 40) {
      var arr = keys.map(function (k) {
        return { k: k, t: store.snapshots[k].t || 0 };
      });
      arr.sort(function (a, b) {
        return a.t - b.t;
      });
      for (var zi = 0; zi < arr.length - 32; zi++) delete store.snapshots[arr[zi].k];
    }
    saveIndexerWatchRootsStore(store);
  }

  function buildIndexerStaleSnapshotCard(bucketId, snap) {
    var userLine =
      snap.userLabel && snap.userLabel !== "—" ? String(snap.userLabel).trim() : "—";
    var prLine =
      snap.projectId && snap.projectId !== "—" ? String(snap.projectId).trim() : "—";
    var flavLine =
      snap.flavorId && snap.flavorId !== "—" ? String(snap.flavorId).trim() : "";
    var titleText =
      flavLine !== "" ? userLine + " — " + prLine + " — " + flavLine : userLine + " — " + prLine;
    var pathsBlock =
      snap.paths && snap.paths.length
        ? "<pre class=\"indexer-paths-pre\">" +
        escapeHtml(snap.paths.join("\n")) +
        "</pre>"
        : '<span class="muted">—</span>';
    var iid = "ix-stale-" + strHash(bucketId);
    var staleMeta = {
      userLabel: userLine,
      projectId: prLine,
      flavorId: flavLine !== "" ? flavLine : "—",
      scopeWorkspaceTotal: null
    };
    return (
      '<details class="sum-card sum-card--indexer-stale" id="' +
      escapeHtml(iid) +
      '">' +
      '<summary>' +
      '<span class="sum-avatar sum-av-c">IX</span>' +
      '<span class="sum-main"><span class="sum-title">' +
      '<span class="sum-title-indexer-head">' +
      escapeHtml(titleText) +
      "</span>" +
      '</span><span class="sum-sub sum-sub--clamp muted">' +
      escapeHtml("Waiting on status update from an indexer worker") +
      "</span></span>" +
      '<span class="sum-chev"></span></summary>' +
      '<div class="sum-body">' +
      '<div class="sum-section-label">Summary</div>' +
      '<dl class="indexer-run-kv">' +
      indexerExpandedSummaryKvInnerHtml(staleMeta, { omitFileCountIfZero: true }) +
      "<dt>Watched paths</dt><dd>" +
      pathsBlock +
      "</dd></dl>" +
      "</div></details>"
    );
  }

  /**
   * When indexer.run.start drops out of the ring buffer, restore watch roots from localStorage.
   * Lookup order: summarized card bucket id (unique per indexer partition), then index_run_id.
   * (Project+flavor alone is ambiguous when multiple indexers share gateway scope.)
   */
  function mergePersistedIndexerWatchRoots(meta, evs, bucketId) {
    var rid = latestIndexRunIdFromEvs(evs);
    var sk = indexerScopeKeyFromMetaAndEvs(meta, evs);

    if (meta.start && meta.watchRootPaths && meta.watchRootPaths.length) {
      persistIndexerWatchRoots(meta.watchRootPaths, rid, sk, bucketId);
      return meta;
    }

    var store = loadIndexerWatchRootsStore();
    var pick = null;
    if (
      bucketId &&
      store.byBucket[bucketId] &&
      store.byBucket[bucketId].paths &&
      store.byBucket[bucketId].paths.length
    ) {
      pick = store.byBucket[bucketId].paths;
    }
    if (!pick && rid && store.byRunId[rid] && store.byRunId[rid].paths && store.byRunId[rid].paths.length) {
      pick = store.byRunId[rid].paths;
    }
    if (pick && pick.length) {
      var curN = meta.watchRootPaths ? meta.watchRootPaths.length : 0;
      if (!curN || pick.length > curN) {
        meta.watchRootPaths = pick.slice();
        meta.filepath = pick.join("\n");
      }
    }
    return meta;
  }

  /** When logs lack indexer.run.start, use operator-store roots from /api/ui/indexer/config (same scope as managed workspaces). */
  function mergeOperatorStorePathsIntoIndexerMeta(meta) {
    if (!meta || typeof meta !== "object") return meta;
    if (meta.watchRootPaths && meta.watchRootPaths.length) return meta;
    var roots = ctx.lastIndexerOperatorRoots;
    if (!roots || !roots.length) return meta;
    var mp = meta.projectId && meta.projectId !== "—" ? String(meta.projectId).trim() : "";
    if (!mp) return meta;
    var mf = normalizeFlavorMatch(meta.flavorId);
    var mw =
      meta.workspaceId && meta.workspaceId !== "—" ? String(meta.workspaceId).trim() : "";
    var out = [];
    var ri;
    for (ri = 0; ri < roots.length; ri++) {
      var row = roots[ri] || {};
      var rp = row.project_id != null ? String(row.project_id).trim() : "";
      if (rp !== mp) continue;
      var rf = normalizeFlavorMatch(row.flavor_id);
      if (rf !== mf) continue;
      var rw = row.workspace_id != null ? String(row.workspace_id).trim() : "";
      if (mw !== "" && rw !== mw) continue;
      var pth = row.path != null ? String(row.path).trim() : "";
      if (pth && out.indexOf(pth) < 0) out.push(pth);
    }
    if (out.length) {
      meta.watchRootPaths = out;
      meta.filepath = out.join("\n");
    }
    return meta;
  }

  function indexerMetaForBucketDedup(run, partitionRegistry) {
    var evs = run.events;
    var pmeta = null;
    if (
      partitionRegistry &&
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.indexerPartitionMetaForRun === "function"
    ) {
      pmeta = ChimeraLogs.Derive.indexerPartitionMetaForRun(
        partitionRegistry,
        run.id,
        evs,
        getFlat
      );
    }
    var meta = collectIndexerRunMeta(run.id, evs, pmeta);
    meta = mergePersistedIndexerWatchRoots(meta, evs, run.id);
    meta = mergeOperatorStorePathsIntoIndexerMeta(meta);
    return meta;
  }

  function operatorWorkspaceCoveredByIndexerRuns(ws, byRun, partitionRegistry) {
    if (!ws || ws.id == null || !byRun || typeof byRun !== "object") return false;
    var wid = canonicalWorkspaceRowIdKey(ws.id);
    if (!wid) return false;
    var opPaths = operatorWorkspacePaths(ws);
    var opProj = String(ws.project_id || "").trim();
    var opFlav = normalizeFlavorMatch(ws.flavor_id);
    var keys = Object.keys(byRun);
    var hi;
    // Pass 1: workspace id in indexer partition/meta matches operator row. Must run before
    // project/flavor filters — drift between supervised YAML and log-derived project fields caused
    // covered=false and duplicate IX + managed WS cards (runtime: ids 3–7 uncovered while 1–2 covered).
    for (hi = 0; hi < keys.length; hi++) {
      var runP1 = byRun[keys[hi]];
      if (!runP1 || !runP1.events || !runP1.events.length) continue;
      var metaId = indexerMetaForBucketDedup(runP1, partitionRegistry);
      var mw0 =
        metaId.workspaceId && metaId.workspaceId !== "—" ? String(metaId.workspaceId).trim() : "";
      if (mw0 && canonicalWorkspaceRowIdKey(mw0) === wid) return true;
    }
    // Pass 2: project + flavor, then workspace id or path set (legacy empty workspace in logs).
    for (hi = 0; hi < keys.length; hi++) {
      var run = byRun[keys[hi]];
      if (!run || !run.events || !run.events.length) continue;
      var meta = indexerMetaForBucketDedup(run, partitionRegistry);
      var mp = meta.projectId && meta.projectId !== "—" ? String(meta.projectId).trim() : "";
      if (mp !== opProj) continue;
      if (normalizeFlavorMatch(meta.flavorId) !== opFlav) continue;
      var mw = meta.workspaceId && meta.workspaceId !== "—" ? String(meta.workspaceId).trim() : "";
      if (mw && canonicalWorkspaceRowIdKey(mw) === wid) return true;
      if (!mw || mw === "—") {
        if (pathsSetEqualForIndexerRoots(meta.watchRootPaths || [], opPaths)) return true;
      }
    }
    return false;
  }

  function operatorWorkspaceNumericId(ws) {
    if (!ws || ws.id == null) return 0;
    var k = canonicalWorkspaceRowIdKey(ws.id);
    if (/^\d+$/.test(k)) {
      var n = parseInt(k, 10);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }

  function findOperatorWorkspaceByNumericId(wsNum) {
    if (!wsNum) return null;
    var wsn = ctx.lastIndexerOperatorWorkspacesNested || [];
    var hi;
    for (hi = 0; hi < wsn.length; hi++) {
      if (operatorWorkspaceNumericId(wsn[hi]) === wsNum) return wsn[hi];
    }
    return null;
  }

  /**
   * When a live indexer partition is backed by an operator-store workspace row, surface the same
   * Configure / path editing UI on the IX card (managed-only cards are omitted when "covered").
   */
  function findOperatorWorkspaceMatchingIndexerMeta(meta) {
    if (!meta || !ctx.lastIndexerOperatorWorkspacesNested || !ctx.lastIndexerOperatorWorkspacesNested.length)
      return null;
    var mw =
      meta.workspaceId && meta.workspaceId !== "—" ? String(meta.workspaceId).trim() : "";
    if (mw) {
      var wkey = canonicalWorkspaceRowIdKey(mw);
      if (wkey) {
        var hi;
        for (hi = 0; hi < ctx.lastIndexerOperatorWorkspacesNested.length; hi++) {
          var w = ctx.lastIndexerOperatorWorkspacesNested[hi];
          if (canonicalWorkspaceRowIdKey(w.id) === wkey) return w;
        }
      }
    }
    var mp = meta.projectId && meta.projectId !== "—" ? String(meta.projectId).trim() : "";
    if (!mp) return null;
    var mf = normalizeFlavorMatch(meta.flavorId);
    var mpaths = meta.watchRootPaths && meta.watchRootPaths.length ? meta.watchRootPaths : [];
    if (!mpaths.length) return null;
    for (hi = 0; hi < ctx.lastIndexerOperatorWorkspacesNested.length; hi++) {
      var wx = ctx.lastIndexerOperatorWorkspacesNested[hi];
      var xp = wx.project_id != null ? String(wx.project_id).trim() : "";
      if (xp !== mp) continue;
      if (normalizeFlavorMatch(wx.flavor_id) !== mf) continue;
      if (pathsSetEqualForIndexerRoots(operatorWorkspacePaths(wx), mpaths)) return wx;
    }
    return null;
  }

  function normalizeManagedPathRowsForEdit(ws) {
    var out = [];
    if (!ws || !Array.isArray(ws.paths)) return out;
    var pi;
    for (pi = 0; pi < ws.paths.length; pi++) {
      var row = ws.paths[pi] || {};
      var pid = row.id != null ? Number(row.id) : NaN;
      var pth = row.path != null ? String(row.path).trim() : "";
      if (!pth) continue;
      if (!isNaN(pid) && pid > 0) out.push({ id: pid, path: pth });
    }
    return out;
  }

  function cloneManagedPathRows(arr) {
    var out = [];
    if (!Array.isArray(arr)) return out;
    var i;
    for (i = 0; i < arr.length; i++) {
      out.push({
        id: arr[i].id != null && !isNaN(Number(arr[i].id)) ? Math.trunc(Number(arr[i].id)) : null,
        path: String(arr[i].path != null ? arr[i].path : "")
      });
    }
    return out;
  }

  function buildManagedWorkspacePathsEditHtml(wsNum, pathRows) {
    var rows = pathRows && pathRows.length ? pathRows : [];
    var rmDisabled = rows.length ? "" : " disabled";
    var selOpts = "";
    var pi;
    for (pi = 0; pi < rows.length; pi++) {
      selOpts +=
        '<option value="' +
        pi +
        '">' +
        escapeHtml(rows[pi].path) +
        "</option>";
    }
    return (
      '<div class="ws-managed-paths-edit" data-ws-managed-paths="' +
      String(wsNum) +
      '">' +
      '<select class="ws-draft-paths-select ws-managed-paths-select" size="6" aria-label="Watched paths">' +
      selOpts +
      "</select>" +
      '<div class="ws-draft-path-btns">' +
      '<button type="button" class="ws-draft-btn ws-managed-btn-add">Add</button>' +
      '<button type="button" class="ws-draft-btn ws-managed-btn-remove"' +
      rmDisabled +
      ">Remove</button>" +
      "</div></div>"
    );
  }

  function buildManagedWorkspaceToolbarHtml(wsNum, isEdit) {
    if (isEdit) {
      return (
        '<div class="ws-managed-toolbar">' +
        '<span class="ws-managed-editing-hint muted">Editing</span>' +
        '<span class="ws-managed-actions">' +
        '<button type="button" class="ws-draft-btn ws-managed-btn-cancel">Cancel</button>' +
        '<button type="button" class="ws-draft-btn ws-managed-btn-save">Save</button>' +
        '<button type="button" class="ws-managed-btn-delete">Delete workspace</button>' +
        "</span></div>"
      );
    }
    return (
      '<div class="ws-managed-toolbar">' +
      '<button type="button" class="ws-draft-btn ws-managed-btn-configure" data-ws-managed-id="' +
      String(wsNum) +
      '">Configure</button>' +
      "</div>"
    );
  }

  function beginWorkspaceManagedEdit(wsNum) {
    var ws = findOperatorWorkspaceByNumericId(wsNum);
    if (!ws) {
      notifyWorkspaceDraftMsg("Workspace not found.", true);
      return;
    }
    var snap = normalizeManagedPathRowsForEdit(ws);
    ctx.workspaceManagedEditId = wsNum;
    ctx.workspaceManagedStaging = {
      wsNum: wsNum,
      initialSnapshot: cloneManagedPathRows(snap),
      paths: cloneManagedPathRows(snap)
    };
    scheduleStoryRebuild();
  }

  function cancelWorkspaceManagedEdit() {
    ctx.workspaceManagedEditId = null;
    ctx.workspaceManagedStaging = null;
    scheduleStoryRebuild();
  }

  function refreshOperatorIndexerWorkspaceStateFromConfig() {
    return fetch("/api/ui/indexer/config", { credentials: "same-origin" }).then(function (res) {
      return res.json().then(function (d) {
        if (!res.ok) throw new Error((d && d.error) || res.statusText || "config fetch failed");
        syncIndexerOperatorPayloadFromConfigJson(d);
        hydrateIndexerServiceSummaryFromApi();
        scheduleStoryRebuild();
      });
    });
  }

  function saveManagedWorkspacePaths(wsNum) {
    var st = ctx.workspaceManagedStaging;
    if (!st || st.wsNum !== wsNum || !Array.isArray(st.paths)) {
      notifyWorkspaceDraftMsg("Nothing to save.", true);
      return;
    }
    if (!st.paths.length) {
      notifyWorkspaceDraftMsg("Add at least one watched path.", true);
      return;
    }
    var initial = st.initialSnapshot || [];
    var cur = st.paths;
    var curPersistedIds = {};
    var ci;
    for (ci = 0; ci < cur.length; ci++) {
      if (cur[ci].id != null && !isNaN(Number(cur[ci].id))) curPersistedIds[Math.trunc(Number(cur[ci].id))] = true;
    }
    var toDelete = [];
    var ii;
    for (ii = 0; ii < initial.length; ii++) {
      var iid = initial[ii].id != null ? Math.trunc(Number(initial[ii].id)) : NaN;
      if (!isNaN(iid) && iid > 0 && !curPersistedIds[iid]) toDelete.push(iid);
    }
    var toAdd = [];
    for (ci = 0; ci < cur.length; ci++) {
      var pth = String(cur[ci].path != null ? cur[ci].path : "").trim();
      if (!pth) continue;
      if (cur[ci].id == null || isNaN(Number(cur[ci].id))) toAdd.push(pth);
    }

    var chain = Promise.resolve();
    var di;
    for (di = 0; di < toDelete.length; di++) {
      (function (pathId) {
        chain = chain.then(function () {
          return fetch("/api/ui/indexer/workspace-paths/" + pathId, {
            method: "DELETE",
            credentials: "same-origin"
          }).then(function (res) {
            return res.json().then(function (j) {
              if (!res.ok) throw new Error((j && j.error) || res.statusText || "delete path failed");
            });
          });
        });
      })(toDelete[di]);
    }
    var ai;
    for (ai = 0; ai < toAdd.length; ai++) {
      (function (absPath) {
        chain = chain.then(function () {
          return fetch("/api/ui/indexer/workspaces/" + wsNum + "/paths", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: absPath })
          }).then(function (res) {
            return res.json().then(function (j) {
              if (!res.ok) throw new Error((j && j.error) || res.statusText || "add path failed");
              return j;
            });
          });
        });
      })(toAdd[ai]);
    }
    chain
      .then(function () {
        ctx.workspaceManagedEditId = null;
        ctx.workspaceManagedStaging = null;
        notifyWorkspaceDraftMsg("Workspace updated.", false);
        return refreshOperatorIndexerWorkspaceStateFromConfig();
      })
      .catch(function (err) {
        notifyWorkspaceDraftMsg(err && err.message ? err.message : String(err), true);
      });
  }

  function deleteManagedWorkspace(wsNum) {
    if (
      !window.confirm(
        "Delete this workspace and all watched paths from configuration? The indexer will stop indexing these paths."
      )
    ) {
      return;
    }
    fetch("/api/ui/indexer/workspaces/" + wsNum, { method: "DELETE", credentials: "same-origin" })
      .then(function (res) {
        return res.json().then(function (j) {
          if (!res.ok) throw new Error((j && j.error) || res.statusText || "delete failed");
        });
      })
      .then(function () {
        ctx.workspaceManagedEditId = null;
        ctx.workspaceManagedStaging = null;
        notifyWorkspaceDraftMsg("Workspace removed.", false);
        return refreshOperatorIndexerWorkspaceStateFromConfig();
      })
      .catch(function (err) {
        notifyWorkspaceDraftMsg(err && err.message ? err.message : String(err), true);
      });
  }

  function buildIndexerOperatorWorkspaceCard(ws, partitionRegistry) {
    var bucketId = operatorWorkspaceSyntheticBucketId(ws);
    var scopedEvs = filterEventsForIndexerScopeFullLog(entryCache, bucketId, partitionRegistry);
    var syntheticRun = { id: bucketId, events: entryCache };
    var meta = collectIndexerRunMeta(bucketId, scopedEvs, null);
    meta = mergePersistedIndexerWatchRoots(meta, scopedEvs, bucketId);
    meta = mergeOperatorStorePathsIntoIndexerMeta(meta);
    var opPaths = operatorWorkspacePaths(ws);
    if ((!meta.watchRootPaths || !meta.watchRootPaths.length) && opPaths.length) {
      meta.watchRootPaths = opPaths.slice();
      meta.filepath = opPaths.join("\n");
    }
    var fvOp =
      ws.flavor_id != null && String(ws.flavor_id).trim() !== ""
        ? String(ws.flavor_id).trim()
        : "—";
    meta.userLabel = resolveLogsOperatorUserLabel();
    meta.projectId = ws.project_id != null ? String(ws.project_id).trim() : "—";
    meta.flavorId = fvOp;
    meta.workspaceId = canonicalWorkspaceRowIdKey(ws.id) || "—";
    var titleText = workspaceCardTitleFromIndexerMeta({
      userLabel: meta.userLabel,
      projectId: meta.projectId,
      flavorId: fvOp
    });
    var widStr = String(ws.id);
    var iid = "ix-opws-" + strHash(widStr);
    var subProse =
      scopedEvs.length > 0
        ? indexerBuildCardSubtitle(meta, scopedEvs)
        : "Saved · waiting for indexer logs (reload supervised config or restart the indexer if this persists)";
    var wsNum = operatorWorkspaceNumericId(ws);
    var isEdit =
      ctx.workspaceManagedEditId != null &&
      ctx.workspaceManagedEditId === wsNum &&
      ctx.workspaceManagedStaging != null &&
      ctx.workspaceManagedStaging.wsNum === wsNum;
    var pathsBlockHtml = null;
    if (isEdit) {
      pathsBlockHtml = buildManagedWorkspacePathsEditHtml(wsNum, ctx.workspaceManagedStaging.paths);
    }
    var toolbar = buildManagedWorkspaceToolbarHtml(wsNum, isEdit);
    var wsRowKey = canonicalWorkspaceRowIdKey(ws.id);
    var expanded = renderExpandedIndexer(syntheticRun, entryCache, meta, partitionRegistry, {
      kvOpts: { omitFileCountIfZero: true, workspaceRowId: wsRowKey },
      recentOpts: { omitWhenEmpty: true },
      pathsBlockHtml: pathsBlockHtml,
      extraAfterSummaryHtml: toolbar
    });
    var cardCls =
      "sum-card sum-card--workspace-operator" + (isEdit ? " sum-card--workspace-operator-editing" : "");
    return (
      '<details class="' +
      cardCls +
      '" id="' +
      escapeHtml(iid) +
      '" open data-workspace-managed-id="' +
      escapeHtml(String(wsNum)) +
      '">' +
      '<summary>' +
      '<span class="sum-avatar sum-av-c" title="Managed workspace">WS</span>' +
      '<span class="sum-main"><span class="sum-title">' +
      '<span class="sum-title-indexer-head">' +
      escapeHtml(titleText) +
      "</span>" +
      '</span><span class="sum-sub sum-sub--clamp muted">' +
      escapeHtml(subProse) +
      "</span></span>" +
      '<span class="sum-chev"></span></summary>' +
      expanded +
      "</details>"
    );
  }

  function buildIndexerCard(run, partitionRegistry) {
    var evs = run.events;
    var pmeta = null;
    if (
      partitionRegistry &&
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.indexerPartitionMetaForRun === "function"
    ) {
      pmeta = ChimeraLogs.Derive.indexerPartitionMetaForRun(partitionRegistry, run.id, evs, getFlat);
    }
    var meta = collectIndexerRunMeta(run.id, evs, pmeta);
    meta = mergePersistedIndexerWatchRoots(meta, evs, run.id);
    meta = mergeOperatorStorePathsIntoIndexerMeta(meta);
    if (meta.watchRootPaths && meta.watchRootPaths.length) {
      persistIndexerWatchRoots(
        meta.watchRootPaths,
        latestIndexRunIdFromEvs(evs),
        indexerScopeKeyFromMetaAndEvs(meta, evs),
        run.id
      );
    }
    var opWsForIx = findOperatorWorkspaceMatchingIndexerMeta(meta);
    var wsNumIx = opWsForIx ? operatorWorkspaceNumericId(opWsForIx) : 0;
    if (opWsForIx) {
      meta.userLabel = resolveLogsOperatorUserLabel();
      meta.projectId =
        opWsForIx.project_id != null ? String(opWsForIx.project_id).trim() : meta.projectId;
      meta.flavorId =
        opWsForIx.flavor_id != null && String(opWsForIx.flavor_id).trim() !== ""
          ? String(opWsForIx.flavor_id).trim()
          : "—";
      meta.workspaceId = canonicalWorkspaceRowIdKey(opWsForIx.id) || meta.workspaceId;
    }
    var isIxEdit =
      wsNumIx > 0 &&
      ctx.workspaceManagedEditId != null &&
      ctx.workspaceManagedEditId === wsNumIx &&
      ctx.workspaceManagedStaging != null &&
      ctx.workspaceManagedStaging.wsNum === wsNumIx;
    var pathsBlockIx = null;
    if (isIxEdit) {
      pathsBlockIx = buildManagedWorkspacePathsEditHtml(wsNumIx, ctx.workspaceManagedStaging.paths);
    }
    var toolbarIx = wsNumIx > 0 ? buildManagedWorkspaceToolbarHtml(wsNumIx, isIxEdit) : "";
    var lastProg = meta.lastProg;
    var doneSeen = meta.doneSeen;
    var errRecent = countErrorSignalsInEntries(sliceRecent(evs, RECENT_CARD_STATUS_N));
    var declared = meta.lastDeclaredState ? String(meta.lastDeclaredState).trim() : "";

    var qIng =
      meta.scopeQueueIngestPending != null && !isNaN(Number(meta.scopeQueueIngestPending))
        ? Number(meta.scopeQueueIngestPending)
        : null;
    var qFan =
      meta.scopeQueueFanoutPending != null && !isNaN(Number(meta.scopeQueueFanoutPending))
        ? Number(meta.scopeQueueFanoutPending)
        : null;
    var pRem = null;
    if (qIng != null || qFan != null) {
      pRem = (qIng != null ? qIng : 0) + (qFan != null ? qFan : 0);
    }
    var qTot =
      meta.scopeWorkspaceTotal != null && !isNaN(Number(meta.scopeWorkspaceTotal))
        ? Math.round(Number(meta.scopeWorkspaceTotal))
        : null;

    var st =
      errRecent > 0
        ? { st: "error", cls: "sum-st-error" }
        : doneSeen
          ? { st: "complete", cls: "sum-st-complete" }
          : declared === "recovery"
            ? { st: "recovery", cls: "sum-st-monitor" }
            : pRem !== null && pRem === 0
              ? { st: "idle", cls: "sum-st-complete" }
              : declared === "watch_idle" || declared === "idle"
                ? { st: "waiting", cls: "sum-st-complete" }
                : { st: "indexing", cls: "sum-st-indexing" };
    var indexerCollapsedIdle = st.st === "idle";

    var prog = indexerBuildCardSubtitle(meta, evs);
    var sub = indexerCollapsedIdle
      ? ""
      : '<span class="sum-sub sum-sub--clamp">' + escapeHtml(prog) + "</span>";
    var titleText = workspaceCardTitleFromIndexerMeta(meta);
    var titleInner =
      '<span class="sum-title-indexer-head">' +
      escapeHtml(titleText) +
      "</span>";
    var backlogLine = "";
    if (pRem !== null && !isNaN(Number(pRem)) && Number(pRem) === 0) {
      backlogLine = "";
    } else if (pRem != null && qTot != null) {
      backlogLine =
        formatInt(Math.round(pRem)) + " remaining of " + formatInt(qTot) + " total";
    } else if (pRem != null) {
      backlogLine = formatInt(Math.round(pRem)) + " remaining of — total";
    } else if (qTot != null) {
      backlogLine = "— remaining of " + formatInt(qTot) + " total";
    } else {
      backlogLine = "—";
    }
    var progressBarHtml = indexerScopeProgressTimelineBarHtml(pRem, qTot, doneSeen);
    var captionSpan =
      backlogLine !== ""
        ? '<span class="indexer-scope-caption">' + escapeHtml(backlogLine) + "</span>"
        : "";
    var progressStack = indexerCollapsedIdle
      ? ""
      : '<div class="indexer-scope-progress" title="Scoped: ingest queue + fan-out file rows pending vs workspace files (from indexer.scope.status)">' +
      progressBarHtml +
      captionSpan +
      "</div>";
    var avatarIndexer = indexerCollapsedIdle
      ? '<span class="sum-avatar sum-av-c sum-av-indexer-idle" aria-hidden="true">\u2713</span>'
      : '<span class="sum-avatar sum-av-c">IX</span>';
    var statusSpan = indexerCollapsedIdle
      ? ""
      : '<span class="sum-status ' + st.cls + '">' + escapeHtml(st.st) + "</span>";
    var iid = "ix-" + strHash(run.id);
    rememberIndexerCardSnapshot(run.id, meta);
    var detailsCls = "sum-card";
    if (wsNumIx > 0) detailsCls += " sum-card--indexer-operator-workspace";
    if (isIxEdit) detailsCls += " sum-card--workspace-operator-editing";
    var dataManagedAttr =
      wsNumIx > 0 ? ' data-workspace-managed-id="' + escapeHtml(String(wsNumIx)) + '"' : "";
    var expOptsIx = {
      kvOpts: {
        omitFileCountIfZero: true,
        workspaceRowId: wsNumIx > 0 ? canonicalWorkspaceRowIdKey(opWsForIx.id) : undefined
      },
      recentOpts: { omitWhenEmpty: true },
      pathsBlockHtml: pathsBlockIx,
      extraAfterSummaryHtml: toolbarIx
    };
    return (
      '<details class="' +
      detailsCls +
      '" id="' +
      escapeHtml(iid) +
      '"' +
      dataManagedAttr +
      "><summary>" +
      avatarIndexer +
      '<span class="sum-main"><span class="sum-title">' +
      titleInner +
      '</span>' +
      sub +
      progressStack +
      "</span>" +
      statusSpan +
      '<span class="sum-chev"></span></summary>' +
      renderExpandedIndexer(run, evs, meta, partitionRegistry, expOptsIx) +
      "</details>"
    );
  }

  function convLastTs(g) {
    var mx = 0;
    for (var u = 0; u < g.events.length; u++) {
      var ti = entryInstant({ ts: g.events[u].ts });
      if (ti) mx = Math.max(mx, ti.getTime());
    }
    return mx;
  }

  function convFirstTs(g) {
    var mn = null;
    for (var u = 0; u < g.events.length; u++) {
      var ti = entryInstant({ ts: g.events[u].ts });
      if (ti) {
        if (mn == null || ti.getTime() < mn.getTime()) mn = ti;
      }
    }
    return mn ? mn.getTime() : 0;
  }

  /**
   * One conversation card per gateway group key (principal + conversation_id).
   * Do not merge different conversation_ids for the same principal by time gap — that hid separate chats in the log UI.
   */
  function sortConversationGroupsByRecency(groups) {
    var arr = [];
    for (var key in groups) {
      if (!Object.prototype.hasOwnProperty.call(groups, key)) continue;
      var gx = groups[key];
      var tmin = convFirstTs(gx);
      var tmax = convLastTs(gx);
      if (!tmax) continue;
      if (!tmin) tmin = tmax;
      arr.push({
        pid: gx.pid,
        cid: gx.cid,
        cids: [gx.cid],
        events: gx.events.slice(),
        tmin: tmin,
        tmax: tmax
      });
    }
    arr.sort(function (a, b) {
      return b.tmax - a.tmax;
    });
    for (var k = 0; k < arr.length; k++) {
      arr[k].events.sort(function (a, b) {
        var sa = a.seq != null ? Number(a.seq) : 0;
        var sb = b.seq != null ? Number(b.seq) : 0;
        if (sa !== sb) return sa - sb;
        var ta = entryInstant({ ts: a.ts });
        var tb = entryInstant({ ts: b.ts });
        if (!ta && !tb) return 0;
        if (!ta) return -1;
        if (!tb) return 1;
        return ta.getTime() - tb.getTime();
      });
    }
    return arr;
  }

  function formatMergedConversationSubtitle(mergedCount) {
    if (!mergedCount || mergedCount <= 1) return "";
    return (
      ' <span class="muted" style="font-size:0.85em" title="Multiple conversation ids in one card (unusual).">(' +
      mergedCount +
      " ids)</span>"
    );
  }

  /** Structured indexer stderr lines sometimes omit service=indexer; still bucket under Services → Indexer. */
  function entryIsIndexerLine(ent) {
    var f = getFlat(ent.parsed);
    var svcL = String(f.service || "").toLowerCase();
    if (svcL === "indexer" || svcL === "chimera-indexer") return true;
    var srcL = ent && String(ent.source || "").toLowerCase();
    if (srcL === "indexer" || srcL === "chimera-indexer") return true;
    var rawMsg = f.msg != null ? f.msg : f.message != null ? f.message : "";
    var msg = String(rawMsg).toLowerCase().trim();
    if (msg.indexOf("indexer.") === 0) return true;
    if (msg.indexOf("gateway.indexer") === 0) return true;
    return false;
  }

  /** Normalize indexer/Gateway scope flavor placeholders so "" matches UI "—". */
  function normalizeIndexerScopeFlavor(v) {
    var s = v != null ? String(v) : "";
    s = s.replace(/\s+/g, " ").trim();
    if (!s) return "";
    if (s === "—" || s === "\u2014" || s === "-" || s.toLowerCase() === "none") return "";
    return s;
  }

  function rebuildIndexerRootScopeMaps() {
    ctx.indexerRootScopeByRootId = {};
    if (
      !globalThis.ChimeraLogs ||
      !ChimeraLogs.Derive ||
      typeof ChimeraLogs.Derive.indexerParseRootScopes !== "function"
    ) {
      return;
    }
    var gi;
    for (gi = 0; gi < entryCache.length; gi++) {
      var ent = entryCache[gi];
      if (!entryIsIndexerLine(ent)) continue;
      var raw = getFlat(ent.parsed);
      var msg = String(raw.msg != null ? raw.msg : raw.message != null ? raw.message : "")
        .toLowerCase()
        .trim();
      if (msg !== "indexer.run.start" && msg !== "indexer run start") continue;
      var rows = ChimeraLogs.Derive.indexerParseRootScopes(raw.root_scopes);
      var ri;
      for (ri = 0; ri < rows.length; ri++) {
        var row = rows[ri];
        if (!row || typeof row !== "object") continue;
        var rslug = row.root_id != null ? String(row.root_id).trim() : "";
        if (!rslug) continue;
        ctx.indexerRootScopeByRootId[rslug] = {
          workspace_id: row.workspace_id != null ? String(row.workspace_id).trim() : "",
          path: row.path != null ? String(row.path).trim() : "",
          ingest_project: row.ingest_project != null ? String(row.ingest_project).trim() : "",
          flavor_id: row.flavor_id != null ? String(row.flavor_id).trim() : ""
        };
      }
    }
  }

  /** Normalize watched root prefix for matching indexer `root` paths (Windows-safe). */
  function rootUnderOneOfPrefixes(root, prefixes) {
    var r = String(root || "")
      .replace(/\\/g, "/")
      .replace(/\/+$/, "")
      .toLowerCase();
    if (!r) return false;
    var i;
    for (i = 0; i < prefixes.length; i++) {
      var p = String(prefixes[i] || "")
        .replace(/\\/g, "/")
        .replace(/\/+$/, "")
        .toLowerCase();
      if (!p) continue;
      if (r === p) return true;
      if (r.indexOf(p + "/") === 0) return true;
    }
    return false;
  }

  function inferTenantForOpwsBucket(bucketId) {
    var segs = String(bucketId || "").split("\u001e");
    if (segs[0] !== "opws" || segs.length < 3) return "";
    var wantWid = String(segs[1] || "").trim();
    var wantProj = String(segs[2] || "").trim();
    var wantFlav = segs.length > 3 ? normalizeIndexerScopeFlavor(segs[3]) : "";
    var ctx = ctx.operatorWsFullLogCtx[bucketId];
    var roots = ctx && ctx.paths ? ctx.paths : [];
    var ei;
    for (ei = entryCache.length - 1; ei >= 0; ei--) {
      var ent = entryCache[ei];
      if (!entryIsIndexerLine(ent)) continue;
      var raw = getFlat(ent.parsed);
      var f =
        globalThis.ChimeraLogs &&
          ChimeraLogs.Derive &&
          typeof ChimeraLogs.Derive.indexerAugmentFlat === "function"
          ? ChimeraLogs.Derive.indexerAugmentFlat(ent, raw)
          : raw;
      var fp = String(f.project_id || f.ingest_project || "").trim();
      var ff = normalizeIndexerScopeFlavor(f.flavor_id);
      if (fp !== wantProj || ff !== wantFlav) continue;
      var sw = f.scope_workspace_id != null ? String(f.scope_workspace_id).trim() : "";
      if (wantWid && sw === wantWid) {
        return String(f.tenant_id || f.principal_id || f.tenant || "").trim();
      }
      var rk = f.root != null ? String(f.root).trim() : "";
      if (wantWid && rk && ctx.indexerRootScopeByRootId[rk]) {
        var rsi = ctx.indexerRootScopeByRootId[rk];
        if (String(rsi.workspace_id || "") === wantWid) {
          return String(f.tenant_id || f.principal_id || f.tenant || "").trim();
        }
        if (rsi.path && roots.length && rootUnderOneOfPrefixes(rsi.path, roots)) {
          return String(f.tenant_id || f.principal_id || f.tenant || "").trim();
        }
      }
    }
    return "";
  }

  function indexerOperatorWorkspaceScopeMatch(ent, bucketId, f) {
    if (!entryIsIndexerLine(ent)) return false;
    var segs = String(bucketId || "").split("\u001e");
    if (segs[0] !== "opws" || segs.length < 3) return false;
    var wantWid = String(segs[1] || "").trim();
    var wantProj = String(segs[2] || "").trim();
    var wantFlav = segs.length > 3 ? normalizeIndexerScopeFlavor(segs[3]) : "";
    var fp = String(f.project_id || f.ingest_project || "").trim();
    var ff = normalizeIndexerScopeFlavor(f.flavor_id);
    if (fp !== wantProj || ff !== wantFlav) return false;
    var sw = f.scope_workspace_id != null ? String(f.scope_workspace_id).trim() : "";
    if (wantWid && sw === wantWid) return true;
    var ctx = ctx.operatorWsFullLogCtx[bucketId];
    var roots = ctx && ctx.paths ? ctx.paths : [];
    var rk = f.root != null ? String(f.root).trim() : "";
    if (wantWid && rk && ctx.indexerRootScopeByRootId[rk]) {
      var rsi = ctx.indexerRootScopeByRootId[rk];
      if (String(rsi.workspace_id || "") === wantWid) return true;
      if (rsi.path && roots.length && rootUnderOneOfPrefixes(rsi.path, roots)) return true;
    }
    return false;
  }

  /** Synthetic bucket id so operator-managed workspaces reuse scoped full-log filtering over entryCache. */
  function operatorWorkspaceSyntheticBucketId(ws) {
    var wid = canonicalWorkspaceRowIdKey(ws.id);
    var pj = String(ws.project_id != null ? ws.project_id : "").trim();
    var fvKey = normalizeIndexerScopeFlavor(ws.flavor_id);
    var bucketId = "opws\u001e" + wid + "\u001e" + pj + "\u001e" + fvKey;
    ctx.operatorWsFullLogCtx[bucketId] = { paths: operatorWorkspacePaths(ws).slice() };
    return bucketId;
  }

  function indexerBucketScopeCoords(bucketId, evs, partitionRegistry) {
    bucketId = bucketId != null ? String(bucketId).trim() : "";
    evs = Array.isArray(evs) ? evs : [];
    if (bucketId.indexOf("opws\u001e") === 0) {
      var opSegs = bucketId.split("\u001e");
      if (opSegs.length >= 3) {
        var opProj = String(opSegs[2] || "").trim();
        var opFlav = opSegs.length > 3 ? normalizeIndexerScopeFlavor(opSegs[3]) : "";
        var opTenant = inferTenantForOpwsBucket(bucketId);
        if (opTenant && opProj && opProj !== "—") {
          return { tenant: opTenant, project: opProj, flavor: opFlav };
        }
      }
    }
    var syn =
      globalThis.ChimeraLogs &&
        ChimeraLogs.Derive &&
        typeof ChimeraLogs.Derive.parseIgSyntheticGid === "function"
        ? ChimeraLogs.Derive.parseIgSyntheticGid(bucketId)
        : null;
    var tenant = "";
    var proj = "";
    var flavor = "";
    if (syn) {
      tenant = syn.tenant || "";
      proj = syn.project || "";
      flavor = syn.flavor || "";
    } else {
      var i;
      for (i = 0; i < evs.length; i++) {
        var rawF = getFlat(evs[i].parsed);
        var fIx =
          globalThis.ChimeraLogs &&
            ChimeraLogs.Derive &&
            typeof ChimeraLogs.Derive.indexerAugmentFlat === "function"
            ? ChimeraLogs.Derive.indexerAugmentFlat(evs[i], rawF)
            : rawF;
        if (
          String(fIx.indexer_target_key || "").trim() === bucketId ||
          String(fIx.indexer_key || "").trim() === bucketId
        ) {
          tenant = String(fIx.tenant_id || fIx.principal_id || fIx.tenant || "").trim();
          proj = String(fIx.project_id || fIx.ingest_project || "").trim();
          flavor = String(fIx.flavor_id != null ? fIx.flavor_id : "").trim();
          break;
        }
      }
      if (!tenant || !proj) {
        for (i = 0; i < evs.length; i++) {
          var rawG = getFlat(evs[i].parsed);
          var fIy =
            globalThis.ChimeraLogs &&
              ChimeraLogs.Derive &&
              typeof ChimeraLogs.Derive.indexerAugmentFlat === "function"
              ? ChimeraLogs.Derive.indexerAugmentFlat(evs[i], rawG)
              : rawG;
          var rid = fIy.index_run_id != null ? String(fIy.index_run_id).trim() : "";
          if (rid && rid === bucketId) {
            tenant = String(fIy.tenant_id || fIy.principal_id || fIy.tenant || "").trim();
            proj = String(fIy.project_id || fIy.ingest_project || "").trim();
            flavor = String(fIy.flavor_id != null ? fIy.flavor_id : "").trim();
            break;
          }
        }
      }
    }
    if (!proj || proj === "—") return null;
    if (!tenant) return null;
    if (flavor === "—") flavor = "";
    return { tenant: tenant, project: proj, flavor: flavor };
  }

  function indexerExpectedVectorstoreCollectionForBucket(bucketId, evs, partitionRegistry) {
    var c = indexerBucketScopeCoords(bucketId, evs, partitionRegistry);
    if (!c) return "";
    if (
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.vectorstoreCollectionName === "function"
    ) {
      return ChimeraLogs.Derive.vectorstoreCollectionName(c.tenant, c.project, c.flavor);
    }
    return "";
  }

  function indexerScopeFullLogInclude(ent, bucketId, partitionRegistry, expectedVectorstoreCollection, bucketScopeCoords) {
    bucketId = bucketId != null ? String(bucketId).trim() : "";
    if (!bucketId) return true;

    var rawFlat = getFlat(ent.parsed);
    var f = rawFlat;
    if (
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.indexerAugmentFlat === "function"
    ) {
      f = ChimeraLogs.Derive.indexerAugmentFlat(ent, rawFlat);
    }

    var srcL = String(ent.source || "").toLowerCase();
    var svcL = String(f.service || "").toLowerCase();
    if (srcL === "chimera-vectorstore" || srcL === "chimera-vectorstore" || svcL === "chimera-vectorstore" || svcL === "chimera-vectorstore") {
      var coll = f.collection != null ? String(f.collection).trim() : "";
      var exp = expectedVectorstoreCollection != null ? String(expectedVectorstoreCollection).trim() : "";
      if (!coll || !exp) return false;
      return coll === exp;
    }

    if (bucketId.indexOf("opws\u001e") === 0) {
      return indexerOperatorWorkspaceScopeMatch(ent, bucketId, f);
    }

    var rid = f.index_run_id != null ? String(f.index_run_id).trim() : "";
    var st = rid && partitionRegistry && partitionRegistry[rid] ? partitionRegistry[rid] : null;

    if (
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.indexerBucketGidsForLine === "function" &&
      st &&
      st.keys &&
      st.keys.length > 0
    ) {
      var gids = ChimeraLogs.Derive.indexerBucketGidsForLine(f, st);
      if (gids && gids.length === 1) {
        return String(gids[0]).trim() === bucketId;
      }
      if (gids && gids.length > 1) {
        return false;
      }
    }

    var itk = f.indexer_target_key != null ? String(f.indexer_target_key).trim() : "";
    if (itk && itk === bucketId) return true;

    var ikk = f.indexer_key != null ? String(f.indexer_key).trim() : "";
    if (ikk && ikk === bucketId) return true;

    if (
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.indexerGroupKeyFromFlat === "function"
    ) {
      var gk = ChimeraLogs.Derive.indexerGroupKeyFromFlat(f);
      if (gk != null && String(gk).trim() === bucketId) return true;
    }

    if (bucketId.indexOf("ig\u001e") === 0) {
      var parts = bucketId.split("\u001e");
      if (parts.length >= 4) {
        var wantP = parts[2] || "";
        var wantF = parts[3] || "";
        var fp = String(f.project_id != null ? f.project_id : f.ingest_project != null ? f.ingest_project : "").trim();
        var ff = String(f.flavor_id != null ? f.flavor_id : "").trim();
        if (fp === wantP && ff === wantF) return true;
      }
    }

    if (rid && rid === bucketId) return true;

    var coords = bucketScopeCoords;
    if (coords && coords.tenant && coords.project) {
      var ragMsg = String(f.msg != null ? f.msg : f.message != null ? f.message : "").trim();
      if (ragMsg.toLowerCase() === "rag.retrieve.source") {
        var rgt = String(f.tenant_id != null ? f.tenant_id : f.principal_id != null ? f.principal_id : "").trim();
        var rgp = String(f.project_id != null ? f.project_id : f.project != null ? f.project : "").trim();
        var rgf = String(f.flavor_id != null ? f.flavor_id : "").trim();
        if (
          rgt &&
          rgp &&
          rgt === coords.tenant &&
          rgp === coords.project &&
          normalizeIndexerScopeFlavor(rgf) === normalizeIndexerScopeFlavor(coords.flavor)
        )
          return true;
      }
    }

    return false;
  }

  function filterEventsForIndexerScopeFullLog(evs, bucketId, partitionRegistry) {
    var out = [];
    if (!Array.isArray(evs)) return out;
    var expColl = indexerExpectedVectorstoreCollectionForBucket(bucketId, evs, partitionRegistry);
    var bucketCoords = indexerBucketScopeCoords(bucketId, evs, partitionRegistry);
    for (var i = 0; i < evs.length; i++) {
      if (indexerScopeFullLogInclude(evs[i], bucketId, partitionRegistry, expColl, bucketCoords)) out.push(evs[i]);
    }
    return out;
  }

  /** Gateway logs upstream relay with service=gateway; bucket those lines under chimera-broker so the card updates with chat traffic. */
  function entryIsGatewayUpstreamRelay(ent) {
    var f = getFlat(ent.parsed);
    var msg = String(f.msg != null ? f.msg : f.message != null ? f.message : "").trim();
    if (
      msg === "chat.chimera-broker.request" ||
      msg === "upstream chat response" ||
      msg === "chat.chimera-broker.response" ||
      msg === "chat.chimera-broker.error" ||
      msg.indexOf("chimera-broker.error") >= 0
    ) {
      return true;
    }
    var sh = ent.parsed.shape || "";
    if (sh === "chat.chimera-broker" || sh.indexOf("chat.chimera-broker.") === 0) return true;
    return false;
  }

  function entryRoutesToChimeraBrokerBucket(ent) {
    if (entryIsGatewayUpstreamRelay(ent)) return true;
    var f = getFlat(ent.parsed);
    var msg = String(f.msg != null ? f.msg : f.message != null ? f.message : "").trim();
    if (msg === "chat.chimera-broker.available_models") return true;
    if (msg === "chat.routing.fallback") return true;
    if (msg === "chat.routing.attempt") return true;
    if (msg === "chat.routing.resolved") return true;
    if (msg === "chat.provider_limits.blocked") return true;
    if (msg.indexOf("virtual model fallback attempt") >= 0) return true;
    if (msg.indexOf("virtual model routing resolved") >= 0) return true;
    return false;
  }

  /** Stable /ui/logs Workspaces bucket: backend indexer_key or tenant + project + flavor fallback. */
  function indexerGroupIdForFlat(fR) {
    if (
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.indexerGroupKeyFromFlat === "function"
    ) {
      var gx = ChimeraLogs.Derive.indexerGroupKeyFromFlat(fR);
      if (gx != null && String(gx).trim() !== "") return String(gx).trim();
    }
    var itk =
      fR.indexer_target_key != null && String(fR.indexer_target_key).trim() !== ""
        ? String(fR.indexer_target_key).trim()
        : "";
    var ik =
      fR.indexer_key != null && String(fR.indexer_key).trim() !== "" ? String(fR.indexer_key).trim() : "";
    var rid = fR.index_run_id != null && fR.index_run_id !== "" ? String(fR.index_run_id) : "";
    return itk || ik || rid || "";
  }

  function renderSummarizedUnified() {
    ctx.operatorWsFullLogCtx = {};
    rebuildIndexerRootScopeMaps();
    var groups = {};
    var reqToConv = {};
    var indexRunToConv = {};
    var gix;
    for (gix = 0; gix < entryCache.length; gix++) {
      tryRegisterRequestConversationCorrelationPrimary(reqToConv, getFlat(entryCache[gix].parsed));
    }
    for (gix = 0; gix < entryCache.length; gix++) {
      tryRegisterRequestConversationCorrelationRagFallback(reqToConv, getFlat(entryCache[gix].parsed));
    }
    for (gix = 0; gix < entryCache.length; gix++) {
      var entIr = entryCache[gix];
      var fIr = getFlat(entIr.parsed);
      var msgIr = String(fIr.msg != null ? fIr.msg : fIr.message != null ? fIr.message : "").trim();
      if (msgIr !== "ingest.complete" && msgIr !== "ingest.failed" && msgIr !== "ingest.chunked.error") continue;
      var irKey = fIr.index_run_id != null ? String(fIr.index_run_id).trim() : "";
      var cidIr = fIr.conversation_id != null ? String(fIr.conversation_id).trim() : "";
      var pidIr =
        fIr.principal_id != null ? String(fIr.principal_id).trim() : fIr.tenant != null ? String(fIr.tenant).trim() : "";
      if (irKey && cidIr && pidIr && !indexRunToConv[irKey]) indexRunToConv[irKey] = { pid: pidIr, cid: cidIr };
    }
    for (gix = 0; gix < entryCache.length; gix++) {
      var ent = entryCache[gix];
      var p = ent.parsed;
      var f = getFlat(p);
      var cid = f.conversation_id != null ? String(f.conversation_id).trim() : "";
      var pid = f.principal_id != null ? String(f.principal_id).trim() : f.tenant != null ? String(f.tenant).trim() : "";
      if (cid) {
        pushConversationGroupedEvent(groups, pid, cid, ent, p, "direct");
        continue;
      }
      var ridJoin = f.request_id != null ? String(f.request_id).trim() : "";
      if (ridJoin && reqToConv[ridJoin] && conversationRequestIdTier2EligibleLocal(f)) {
        pushConversationGroupedEvent(groups, reqToConv[ridJoin].pid, reqToConv[ridJoin].cid, ent, p, "request_id");
        continue;
      }
      var irJoin = f.index_run_id != null ? String(f.index_run_id).trim() : "";
      if (irJoin && indexRunToConv[irJoin] && conversationIndexRunTier3EligibleLocal(f)) {
        pushConversationGroupedEvent(
          groups,
          indexRunToConv[irJoin].pid,
          indexRunToConv[irJoin].cid,
          ent,
          p,
          "ingest"
        );
      }
    }
    var gkSort;
    for (gkSort in groups) {
      if (!Object.prototype.hasOwnProperty.call(groups, gkSort)) continue;
      groups[gkSort].events.sort(function (a, b) {
        var sa = a.seq != null ? Number(a.seq) : 0;
        var sb = b.seq != null ? Number(b.seq) : 0;
        if (sa !== sb) return sa - sb;
        var ta = entryInstant({ ts: a.ts });
        var tb = entryInstant({ ts: b.ts });
        if (!ta && !tb) return 0;
        if (!ta) return -1;
        if (!tb) return 1;
        return ta.getTime() - tb.getTime();
      });
    }
    if (
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.joinVectorstoreLineConversationTier === "function"
    ) {
      for (gix = 0; gix < entryCache.length; gix++) {
        var entQ = entryCache[gix];
        if (!entryIsVectorstoreSubprocessForConvJoin(entQ)) continue;
        var fQ = getFlat(entQ.parsed);
        var collQ = fQ.collection != null ? String(fQ.collection).trim() : "";
        if (!collQ) continue;
        var tQ = entryInstant({ ts: entQ.ts });
        if (!tQ) continue;
        var tMs = tQ.getTime();
        var gkQ;
        for (gkQ in groups) {
          if (!Object.prototype.hasOwnProperty.call(groups, gkQ)) continue;
          var grp = groups[gkQ];
          var qMatch = null;
          if (typeof ChimeraLogs.Derive.joinVectorstoreLineConversationMatch === "function") {
            qMatch = ChimeraLogs.Derive.joinVectorstoreLineConversationMatch(grp.events, getFlat, fQ, tMs);
          }
          var tierQ = qMatch && qMatch.tier ? qMatch.tier : ChimeraLogs.Derive.joinVectorstoreLineConversationTier(grp.events, getFlat, fQ, tMs);
          if (tierQ) {
            pushConversationGroupedEvent(groups, grp.pid, grp.cid, entQ, entQ.parsed, tierQ, qMatch);
          }
        }
      }
      for (gkSort in groups) {
        if (!Object.prototype.hasOwnProperty.call(groups, gkSort)) continue;
        groups[gkSort].events.sort(function (a, b) {
          var sa = a.seq != null ? Number(a.seq) : 0;
          var sb = b.seq != null ? Number(b.seq) : 0;
          if (sa !== sb) return sa - sb;
          var ta2 = entryInstant({ ts: a.ts });
          var tb2 = entryInstant({ ts: b.ts });
          if (!ta2 && !tb2) return 0;
          if (!ta2) return -1;
          if (!tb2) return 1;
          return ta2.getTime() - tb2.getTime();
        });
      }
    }
    var buckets = {
      "chimera-gateway": [],
      "chimera-vectorstore": [],
      "chimera-broker": [],
      "chimera-indexer": []
    };
    for (var bi = 0; bi < entryCache.length; bi++) {
      var entB = entryCache[bi];
      var pB = entB.parsed;
      var fB = getFlat(pB);
      var svcKey = "";
      if (entryRoutesToChimeraBrokerBucket(entB)) svcKey = "chimera-broker";
      else if (entryIsIndexerLine(entB)) svcKey = "chimera-indexer";
      else {
        svcKey = normalizeServiceBucketKey(fB.service, entB.source);
        if (!svcKey) svcKey = "chimera-gateway";
      }
      if (!buckets[svcKey]) buckets[svcKey] = [];
      buckets[svcKey].push(entB);
    }
    var byRun = {};
    var partitionRegistry = {};
    var ibuilt = null;
    if (
      globalThis.ChimeraLogs &&
      ChimeraLogs.Derive &&
      typeof ChimeraLogs.Derive.indexerBucketsFromCache === "function"
    ) {
      ibuilt = ChimeraLogs.Derive.indexerBucketsFromCache(entryCache, getFlat);
      if (ibuilt && ibuilt.targetStateByRunId) partitionRegistry = ibuilt.targetStateByRunId;
      if (ibuilt && ibuilt.buckets) byRun = ibuilt.buckets;
    }
    if (!ibuilt || !Object.keys(byRun).length) {
      byRun = {};
      partitionRegistry = {};
      for (var ri = 0; ri < entryCache.length; ri++) {
        var entRL = entryCache[ri];
        var fRL = getFlat(entRL.parsed);
        var groupIdL = indexerGroupIdForFlat(fRL);
        if (!groupIdL) continue;
        if (!byRun[groupIdL]) byRun[groupIdL] = { id: groupIdL, events: [] };
        byRun[groupIdL].events.push(entRL);
      }
    } else {
      for (var normK in byRun) {
        if (!Object.prototype.hasOwnProperty.call(byRun, normK)) continue;
        var arrN = byRun[normK];
        byRun[normK] = { id: normK, events: arrN };
      }
    }
    ctx.lastIndexerSummarizeByRun = byRun;
    ctx.lastIndexerSummarizePartitionRegistry = partitionRegistry;
    var qFan = buckets["chimera-vectorstore"];
    if (qFan && qFan.length && byRun && Object.keys(byRun).length) {
      var collByRun = {};
      var buck;
      for (buck in byRun) {
        if (!Object.prototype.hasOwnProperty.call(byRun, buck)) continue;
        var runB = byRun[buck];
        collByRun[buck] = indexerExpectedVectorstoreCollectionForBucket(runB.id, runB.events, partitionRegistry);
      }
      var qx, qb;
      for (qx = 0; qx < qFan.length; qx++) {
        var qEnt = qFan[qx];
        var qFl = getFlat(qEnt.parsed);
        var qCol = qFl.collection != null ? String(qFl.collection).trim() : "";
        if (!qCol) continue;
        for (qb in byRun) {
          if (!Object.prototype.hasOwnProperty.call(byRun, qb)) continue;
          if (collByRun[qb] === qCol) byRun[qb].events.push(qEnt);
        }
      }
      for (var qs in byRun) {
        if (!Object.prototype.hasOwnProperty.call(byRun, qs)) continue;
        byRun[qs].events.sort(function (a, b) {
          var sa = a.seq != null ? Number(a.seq) : 0;
          var sb = b.seq != null ? Number(b.seq) : 0;
          if (sa !== sb) return sa - sb;
          var ta = entryInstant({ ts: a.ts });
          var tb = entryInstant({ ts: b.ts });
          if (!ta && !tb) return 0;
          if (!ta) return -1;
          if (!tb) return 1;
          return ta.getTime() - tb.getTime();
        });
      }
    }

    // Attach gateway RAG retrieval lines to the right indexer bucket so the
    // Workspaces card "Recently evaluated files" can show retrieved sources.
    var gFan = buckets["chimera-gateway"];
    if (gFan && gFan.length && byRun && Object.keys(byRun).length) {
      // Build bucket → {tenant, project, flavor} map from existing indexer events.
      var scopeByRun = {};
      var rkx;
      var runIds = Object.keys(byRun);
      for (rkx = 0; rkx < runIds.length; rkx++) {
        var runX = byRun[runIds[rkx]];
        if (!runX || !runX.events) continue;
        var pmX = null;
        if (
          partitionRegistry &&
          globalThis.ChimeraLogs &&
          ChimeraLogs.Derive &&
          typeof ChimeraLogs.Derive.indexerPartitionMetaForRun === "function"
        ) {
          pmX = ChimeraLogs.Derive.indexerPartitionMetaForRun(partitionRegistry, runX.id, runX.events, getFlat);
        }
        var metaX = collectIndexerRunMeta(runX.id, runX.events, pmX);
        if (!metaX) continue;
        scopeByRun[runX.id] = {
          tenant: metaX.tenantId != null ? String(metaX.tenantId).trim() : "",
          project: metaX.projectId != null ? String(metaX.projectId).trim() : "",
          flavor: metaX.flavorId != null ? String(metaX.flavorId).trim() : ""
        };
      }
      var gx, gb;
      for (gx = 0; gx < gFan.length; gx++) {
        var gEnt = gFan[gx];
        var gFl = getFlat(gEnt.parsed);
        var gMsg = String(gFl.msg != null ? gFl.msg : gFl.message != null ? gFl.message : "").trim();
        if (gMsg !== "rag.retrieve.source") continue;
        var gt = String(gFl.tenant_id != null ? gFl.tenant_id : gFl.principal_id != null ? gFl.principal_id : "").trim();
        var gp = String(gFl.project_id != null ? gFl.project_id : gFl.project != null ? gFl.project : "").trim();
        var gf = String(gFl.flavor_id != null ? gFl.flavor_id : "").trim();
        if (!gt || !gp) continue;
        for (gb in byRun) {
          if (!Object.prototype.hasOwnProperty.call(byRun, gb)) continue;
          var sc = scopeByRun[gb];
          if (!sc || !sc.project) continue;
          if (
            (sc.tenant && sc.tenant !== gt) ||
            sc.project !== gp ||
            normalizeIndexerScopeFlavor(sc.flavor) !== normalizeIndexerScopeFlavor(gf)
          )
            continue;
          byRun[gb].events.push(gEnt);
        }
      }

      // Keep chronological order after attaching.
      for (var gsort in byRun) {
        if (!Object.prototype.hasOwnProperty.call(byRun, gsort)) continue;
        byRun[gsort].events.sort(function (a, b) {
          var sa = a.seq != null ? Number(a.seq) : 0;
          var sb = b.seq != null ? Number(b.seq) : 0;
          if (sa !== sb) return sa - sb;
          var ta = entryInstant({ ts: a.ts });
          var tb = entryInstant({ ts: b.ts });
          if (!ta && !tb) return 0;
          if (!ta) return -1;
          if (!tb) return 1;
          return ta.getTime() - tb.getTime();
        });
      }
    }
    var mergedConv = sortConversationGroupsByRecency(groups);
    var convTimeline = [];
    for (var ci = 0; ci < mergedConv.length; ci++) {
      var gx = mergedConv[ci];
      convTimeline.push({ sort: convLastTs(gx), html: buildConvCard(gx) });
    }
    convTimeline.sort(function (a, b) {
      return b.sort - a.sort;
    });
    var svcHtml = "";
    var order = ["chimera-broker", "chimera-gateway", "chimera-indexer", "chimera-vectorstore"];
    for (var oi = 0; oi < order.length; oi++) {
      var nm = order[oi];
      var arr = buckets[nm];
      if (!arr || !arr.length) continue;
      svcHtml += buildServiceCard(nm, arr, { byRun: byRun, partitionRegistry: partitionRegistry });
    }
    var idxTimeline = [];
    var seenIndexerBuckets = {};
    var liveIndexerIdentities = {};
    var dedupeGroups = {};
    var rks = Object.keys(byRun);
    for (var rj = 0; rj < rks.length; rj++) {
      var runG = byRun[rks[rj]];
      if (!runG) continue;
      var pmetaG = null;
      if (
        partitionRegistry &&
        globalThis.ChimeraLogs &&
        ChimeraLogs.Derive &&
        typeof ChimeraLogs.Derive.indexerPartitionMetaForRun === "function"
      ) {
        pmetaG = ChimeraLogs.Derive.indexerPartitionMetaForRun(
          partitionRegistry,
          runG.id,
          runG.events,
          getFlat
        );
      }
      var metaG = collectIndexerRunMeta(runG.id, runG.events, pmetaG);
      metaG = mergePersistedIndexerWatchRoots(metaG, runG.events, runG.id);
      var dk = indexerRunTimelineDedupeKey(metaG, runG.id);
      if (!dedupeGroups[dk]) dedupeGroups[dk] = [];
      dedupeGroups[dk].push(runG);
    }
    var dkIter;
    var headlinesWithIndexerOrStaleCard = Object.create(null);
    for (dkIter in dedupeGroups) {
      if (!Object.prototype.hasOwnProperty.call(dedupeGroups, dkIter)) continue;
      var grpRuns = dedupeGroups[dkIter];
      var run = pickCanonicalIndexerRun(grpRuns);
      if (!run) continue;
      var gi;
      for (gi = 0; gi < grpRuns.length; gi++) {
        seenIndexerBuckets[grpRuns[gi].id] = true;
      }
      var pmetaLive = null;
      if (
        partitionRegistry &&
        globalThis.ChimeraLogs &&
        ChimeraLogs.Derive &&
        typeof ChimeraLogs.Derive.indexerPartitionMetaForRun === "function"
      ) {
        pmetaLive = ChimeraLogs.Derive.indexerPartitionMetaForRun(
          partitionRegistry,
          run.id,
          run.events,
          getFlat
        );
      }
      var metaLive = collectIndexerRunMeta(run.id, run.events, pmetaLive);
      metaLive = mergePersistedIndexerWatchRoots(metaLive, run.events, run.id);
      liveIndexerIdentities[indexerCardIdentityKey(metaLive)] = true;
      var ixHead = workspaceCardTitleFromIndexerMeta(metaLive);
      if (ixHead) headlinesWithIndexerOrStaleCard[ixHead] = true;
      var sortLabel = indexerCardTitleSortLabel(metaLive) + "\u0001" + String(run.id || "");
      idxTimeline.push({ sortKey: sortLabel, html: buildIndexerCard(run, partitionRegistry) });
    }
    var snapStore = loadIndexerWatchRootsStore();
    if (snapStore.snapshots) {
      for (var sbi in snapStore.snapshots) {
        if (!Object.prototype.hasOwnProperty.call(snapStore.snapshots, sbi)) continue;
        if (seenIndexerBuckets[sbi]) continue;
        var sn = snapStore.snapshots[sbi];
        if (liveIndexerIdentities[indexerCardIdentityKeyFromSnap(sn)]) continue;
        var staleHead = workspaceCardTitleFromIndexerMeta({
          userLabel: sn.userLabel,
          projectId: sn.projectId,
          flavorId: sn.flavorId
        });
        if (staleHead) headlinesWithIndexerOrStaleCard[staleHead] = true;
        idxTimeline.push({
          sortKey: indexerCardTitleSortLabel(sn) + "\u0001" + String(sbi),
          html: buildIndexerStaleSnapshotCard(sbi, sn)
        });
      }
    }
    var wsn = dedupeOperatorWorkspacesNested(ctx.lastIndexerOperatorWorkspacesNested.slice());
    wsn.sort(function (a, b) {
      var ak = canonicalWorkspaceRowIdKey(a.id);
      var bk = canonicalWorkspaceRowIdKey(b.id);
      var an = parseInt(ak, 10);
      var bn = parseInt(bk, 10);
      if (/^\d+$/.test(ak) && /^\d+$/.test(bk) && !isNaN(an) && !isNaN(bn)) return an - bn;
      return String(ak).localeCompare(String(bk));
    });
    var seenManagedWsTitle = Object.create(null);
    var wdx;
    for (wdx = 0; wdx < ctx.workspaceDrafts.length; wdx++) {
      var draftHead = workspaceDraftComparableManagedTitle(ctx.workspaceDrafts[wdx]);
      if (draftHead) seenManagedWsTitle[draftHead] = true;
    }
    if (wsn && wsn.length) {
      for (var owi = 0; owi < wsn.length; owi++) {
        var ows = wsn[owi];
        if (!ows || ows.id == null) continue;
        var headTtl = operatorManagedWorkspaceTitleText(ows);
        if (seenManagedWsTitle[headTtl]) continue;
        if (headlinesWithIndexerOrStaleCard[headTtl]) continue;
        seenManagedWsTitle[headTtl] = true;
        if (operatorWorkspaceCoveredByIndexerRuns(ows, byRun, partitionRegistry)) continue;
        var sortOp =
          headTtl + "\u0001opws-" + canonicalWorkspaceRowIdKey(ows.id);
        idxTimeline.push({
          sortKey: sortOp,
          html: buildIndexerOperatorWorkspaceCard(ows, partitionRegistry)
        });
      }
    }
    idxTimeline.sort(function (a, b) {
      var ka = a.sortKey != null ? String(a.sortKey) : "";
      var kb = b.sortKey != null ? String(b.sortKey) : "";
      return ka.localeCompare(kb, undefined, { sensitivity: "base", numeric: true });
    });
    var body = buildGatewayOverviewFeedSection() + buildAdminWorkflowsFeedSection();
    if (convTimeline.length) {
      body +=
        '<div class="sum-feed-section"><div class="sum-section-label sum-feed-section-title">Conversations</div>';
      for (var zc = 0; zc < convTimeline.length; zc++) body += convTimeline[zc].html;
      body += "</div>";
    }
    body +=
      '<div class="sum-feed-section sum-feed-section--workspaces">' +
      '<div class="sum-feed-section-head">' +
      '<span class="sum-feed-section-title sum-section-label">Workspaces</span>' +
      '<button type="button" class="sum-workspaces-create-btn" data-sum-workspaces-create="1">Create</button>' +
      "</div>" +
      buildWorkspacesSectionIntroHtml();
    var wdi;
    for (wdi = 0; wdi < ctx.workspaceDrafts.length; wdi++) {
      body += buildWorkspaceDraftCardHtml(ctx.workspaceDrafts[wdi]);
    }
    for (var zi = 0; zi < idxTimeline.length; zi++) body += idxTimeline[zi].html;
    body += "</div>";
    if (svcHtml) {
      body +=
        '<div class="sum-feed-section"><div class="sum-section-label sum-feed-section-title">Services</div>' +
        svcHtml +
        "</div>";
    }
    var hasThreads =
      convTimeline.length > 0 ||
      idxTimeline.length > 0 ||
      svcHtml.length > 0 ||
      ctx.workspaceDrafts.length > 0;
    if (!hasThreads) {
      body +=
        '<p class="muted">No conversation / service cards in the <em>loaded</em> window yet. Chat traffic needs <code>conversation_id</code> in structured logs; <strong>scroll to the top</strong> of this feed to load older lines (indexer snapshots often crowd the recent tail). Switch to <strong>StructuredLogs</strong> for the full stream.</p>';
    }
    return body;
  }
  ctx.refreshSummarizedPanel = refreshSummarizedPanel;
  ctx.scheduleDeferredSummarizedRefresh = scheduleDeferredSummarizedRefresh;
  ctx.summarizedEvlogInteractionBlocksRebuild = summarizedEvlogInteractionBlocksRebuild;
  ctx.scheduleStoryRebuild = scheduleStoryRebuild;
  ctx.renderSummarizedUnified = renderSummarizedUnified;
  ctx.patchGatewayUsageMetricsCard = patchGatewayUsageMetricsCard;
  ctx.patchGatewayOverviewCard = patchGatewayOverviewCard;
  ctx.fetchTokenLabels = fetchTokenLabels;
  ctx.fetchGatewayMetrics = fetchGatewayMetrics;
  ctx.fetchGatewayOverview = fetchGatewayOverview;
  ctx.fetchChimeraBrokerProviderSnapshot = fetchChimeraBrokerProviderSnapshot;
  ctx.fetchAdminState = fetchAdminState;
  ctx.fetchAdminTokens = fetchAdminTokens;
  ctx.syncMetricsPolling = syncMetricsPolling;
  ctx.syncGatewayOverviewPolling = syncGatewayOverviewPolling;
  ctx.syncChimeraBrokerProviderPolling = syncChimeraBrokerProviderPolling;
  ctx.syncAdminStatePolling = syncAdminStatePolling;
  ctx.adminPostJSON = adminPostJSON;
  ctx.adminSetMessage = adminSetMessage;
  ctx.parseFallbackChainInput = parseFallbackChainInput;
  ctx.fallbackChainToYAML = fallbackChainToYAML;
  ctx.pickFolderForWorkspaceDraft = pickFolderForWorkspaceDraft;
  ctx.findWorkspaceDraft = findWorkspaceDraft;
  ctx.appendWorkspaceDraftPath = appendWorkspaceDraftPath;
  ctx.syncWorkspaceDraftHeader = syncWorkspaceDraftHeader;
};

