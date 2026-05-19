/**
 * Summarized feed card render (Phase 3 extraction).
 * Registers builders on ctx during ChimeraLogs.Render.Cards.mount*.
 */
globalThis.ChimeraLogs = globalThis.ChimeraLogs || {};
globalThis.ChimeraLogs.Render = globalThis.ChimeraLogs.Render || {};
globalThis.ChimeraLogs.Render.Cards = globalThis.ChimeraLogs.Render.Cards || {};

globalThis.ChimeraLogs.Render.Cards.mountGatewayOverview = function (ctx) {
  var escapeHtml = ctx.escapeHtml;
  var formatUtcLikeLogTimestamp = ctx.formatUtcLikeLogTimestamp;

  function gatewayServiceHealthTone(raw) {
    var s = String(raw || "").trim().toLowerCase();
    if (
      s === "up" ||
      s === "ok" ||
      s === "healthy" ||
      s === "ready" ||
      s === "running" ||
      s === "enabled" ||
      s === "supervised" ||
      s === "starting"
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
      '<span class="sum-avatar sum-av-svc-chimera-gateway">GW</span>' +
      '<span class="sum-main"><span class="sum-title">Overview</span>' +
      sub +
      "</span>" +
      compactHealth +
      '<span class="sum-chev"></span></summary>' +
      '<div class="sum-body">' + body + "</div></details>"
    );
  }

  function buildGatewayOverviewFeedSection() {
    var buildGatewayUsageCardHtml = ctx.buildGatewayUsageCardHtml;
    return (
      '<div class="sum-feed-section">' +
      buildGatewayOverviewCardHtml() +
      (typeof buildGatewayUsageCardHtml === "function" ? buildGatewayUsageCardHtml() : "") +
      "</div>"
    );
  }

  ctx.gatewayServiceHealthTone = gatewayServiceHealthTone;
  ctx.gatewayServiceHealthEntries = gatewayServiceHealthEntries;
  ctx.gatewayServiceHealthStripHtml = gatewayServiceHealthStripHtml;
  ctx.buildGatewayOverviewCardHtml = buildGatewayOverviewCardHtml;
  ctx.buildGatewayOverviewFeedSection = buildGatewayOverviewFeedSection;
};
