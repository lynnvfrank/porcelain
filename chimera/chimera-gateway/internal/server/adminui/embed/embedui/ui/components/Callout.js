/**
 * Callout panel (.callout from ui.css).
 */

function esc() {
  return globalThis.ChimeraUI && globalThis.ChimeraUI.escapeHtml
    ? globalThis.ChimeraUI.escapeHtml
    : function (s) {
        return String(s);
      };
}

/**
 * @param {string} innerHtml already-safe or plain text (escaped when no tags expected)
 * @param {{escape?: boolean, className?: string}=} opts
 * @returns {string}
 */
function render(innerHtml, opts) {
  opts = opts || {};
  var body = innerHtml != null ? String(innerHtml) : "";
  if (opts.escape !== false && body.indexOf("<") < 0) body = esc()(body);
  var cls = opts.className != null ? String(opts.className) : "callout";
  return '<div class="' + cls + '">' + body + "</div>";
}

globalThis.ChimeraUI = globalThis.ChimeraUI || {};
globalThis.ChimeraUI.Callout = { render: render };
