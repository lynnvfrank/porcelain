/**
 * Card and event-log status indicators (.sum-status, .sum-evlog-status).
 */

function esc() {
  return globalThis.ChimeraUI && globalThis.ChimeraUI.escapeHtml
    ? globalThis.ChimeraUI.escapeHtml
    : function (s) {
        return String(s);
      };
}

function escA() {
  return globalThis.ChimeraUI && globalThis.ChimeraUI.escapeAttr
    ? globalThis.ChimeraUI.escapeAttr
    : esc();
}

/**
 * @param {{label: string, variantClass: string, pulse?: boolean, title?: string}=} model
 * @returns {string}
 */
function render(model) {
  model = model || {};
  var label = model.label != null ? String(model.label) : "";
  var cls = model.variantClass != null ? String(model.variantClass) : "sum-st-monitor";
  if (model.pulse && cls.indexOf("sum-pulse") < 0) cls += " sum-pulse";
  var title = model.title != null ? String(model.title) : "";
  return (
    '<span class="sum-status ' +
    escA()(cls) +
    '"' +
    (title ? ' title="' + escA()(title) + '"' : "") +
    ">" +
    esc()(label) +
    "</span>"
  );
}

/**
 * Event-log status column: level pill(s) + optional HTTP pill.
 * @param {{levelKey?: string, http?: number|null}=} model
 * @returns {string}
 */
function evlogRow(model) {
  model = model || {};
  var Pill = globalThis.ChimeraUI && globalThis.ChimeraUI.Pill;
  var lk = model.levelKey == null ? "" : String(model.levelKey).trim();
  if (lk === "" || lk === "—") lk = "_NONE";
  else lk = lk.toUpperCase();
  var parts = [];
  if (Pill && typeof Pill.renderEvlogLevel === "function") {
    var lvl = Pill.renderEvlogLevel(lk);
    if (lvl) parts.push(lvl);
  }
  if (model.http != null && Pill && typeof Pill.renderHttpStatus === "function") {
    var httpPill = Pill.renderHttpStatus(model.http, { asChip: model.http === 304 });
    if (httpPill) parts.push(httpPill);
  }
  if (!parts.length) {
    return '<span class="sum-evlog-status__empty" aria-hidden="true"></span>';
  }
  return parts.join("");
}

/**
 * Header metric pills for warn/fail counts in event-log table.
 * @param {{warn: number, fail: number}} counts
 * @returns {string}
 */
function evlogHeaderMetrics(counts) {
  counts = counts || {};
  var warnN = counts.warn != null ? counts.warn : 0;
  var failN = counts.fail != null ? counts.fail : 0;
  var e = esc();
  return (
    '<span class="sum-evlog-status__pill sum-evlog-status__lvl--WARN sum-evlog-metric-num" data-sum-evlog-metric-warn title="Lines with WARN or HTTP 429 in this card">' +
    e(String(warnN)) +
    "</span>" +
    '<span class="sum-evlog-status__pill sum-evlog-status__lvl--WARN sum-evlog__metric-icon" aria-hidden="true">⚠</span>' +
    '<span class="sum-evlog-status__pill sum-evlog-status__lvl--ERROR sum-evlog-metric-num" data-sum-evlog-metric-fail title="Lines with ERROR or HTTP non-2xx in this card">' +
    e(String(failN)) +
    "</span>" +
    '<span class="sum-evlog-status__pill sum-evlog-status__lvl--ERROR sum-evlog__metric-icon" aria-hidden="true">✖</span>'
  );
}

/**
 * Inline service badge before event-log message body.
 * @param {{lab?: string, cls?: string}=} badge
 * @returns {string}
 */
function serviceBadge(badge) {
  if (!badge || !badge.lab) return "";
  var cls = badge.cls != null ? String(badge.cls) : "";
  return (
    '<span class="sum-svc-badge ' +
    escA()(cls) +
    '">' +
    esc()(badge.lab) +
    "</span>"
  );
}

globalThis.ChimeraUI = globalThis.ChimeraUI || {};
globalThis.ChimeraUI.StatusIndicator = {
  render: render,
  evlogRow: evlogRow,
  evlogHeaderMetrics: evlogHeaderMetrics,
  serviceBadge: serviceBadge
};
