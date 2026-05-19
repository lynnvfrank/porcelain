/**
 * Segmented timeline bars (.sum-timeline-bar).
 */

function escA() {
  return globalThis.ChimeraUI && globalThis.ChimeraUI.escapeAttr
    ? globalThis.ChimeraUI.escapeAttr
    : function (s) {
        return String(s);
      };
}

/**
 * @param {{pct: number, bg: string}[]} segments
 * @param {{extraClass?: string, title?: string}=} opts
 * @returns {string}
 */
function segments(segments, opts) {
  opts = opts || {};
  segments = Array.isArray(segments) ? segments : [];
  var extra = opts.extraClass ? " " + String(opts.extraClass) : "";
  var title = opts.title != null ? String(opts.title) : "";
  var html =
    '<div class="sum-timeline-bar' +
    escA()(extra.trim()) +
    '"' +
    (title ? ' title="' + escA()(title) + '"' : "") +
    ">";
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i] || {};
    var pct = seg.pct;
    if (pct == null || pct < 0.05) continue;
    var bg = seg.bg != null ? String(seg.bg) : "";
    html +=
      '<span class="sum-timeline-seg" style="width:' +
      Number(pct).toFixed(1) +
      "%;background:" +
      bg +
      '"></span>';
  }
  return html + "</div>";
}

globalThis.ChimeraUI = globalThis.ChimeraUI || {};
globalThis.ChimeraUI.TimelineBar = { segments: segments };
