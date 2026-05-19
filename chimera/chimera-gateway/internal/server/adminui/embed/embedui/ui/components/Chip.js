/**
 * Service / metric chips (.chip in .service-chips or .sum-metrics).
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
 * @param {string} text
 * @param {{title?: string, className?: string}=} opts
 * @returns {string}
 */
function render(text, opts) {
  opts = opts || {};
  var title = opts.title != null ? String(opts.title) : "";
  var extra = opts.className ? " " + String(opts.className) : "";
  return (
    '<span class="chip' +
    escA()(extra.trim() ? extra : "") +
    '"' +
    (title ? ' title="' + escA()(title) + '"' : "") +
    ">" +
    esc()(text != null ? text : "") +
    "</span>"
  );
}

/**
 * @param {string[]} parts
 * @param {{wrapClass?: string}=} opts
 * @returns {string}
 */
function renderRow(parts, opts) {
  opts = opts || {};
  parts = Array.isArray(parts) ? parts : [];
  if (!parts.length) return "";
  var wrapCls = opts.wrapClass != null ? String(opts.wrapClass) : "service-chips";
  var inner = "";
  for (var i = 0; i < parts.length; i++) {
    inner += render(parts[i]);
  }
  return '<div class="' + escA()(wrapCls) + '">' + inner + "</div>";
}

globalThis.ChimeraUI = globalThis.ChimeraUI || {};
globalThis.ChimeraUI.Chip = { render: render, renderRow: renderRow };
