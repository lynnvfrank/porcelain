/**
 * @param {{text: string, title?: string}[]} pills
 * @returns {string}
 */
function MetricPillsRow(pills) {
  var esc = globalThis.ChimeraUI && globalThis.ChimeraUI.escapeHtml ? globalThis.ChimeraUI.escapeHtml : function (s) { return String(s); };
  var escA = globalThis.ChimeraUI && globalThis.ChimeraUI.escapeAttr ? globalThis.ChimeraUI.escapeAttr : esc;
  pills = Array.isArray(pills) ? pills : [];
  if (!pills.length) return "";
  var out = '<span class="sum-metrics">';
  for (var i = 0; i < pills.length; i++) {
    var p = pills[i] || {};
    var txt = p.text != null ? String(p.text) : "";
    var title = p.title != null ? String(p.title) : "";
    out +=
      '<span class="sum-metric"' +
      (title ? ' title="' + escA(title) + '"' : "") +
      ">" +
      esc(txt) +
      "</span>";
  }
  out += "</span>";
  return out;
}

globalThis.ChimeraUI = globalThis.ChimeraUI || {};
globalThis.ChimeraUI.MetricPillsRow = MetricPillsRow;
