/**
 * Tagged-template helper: interpolations are HTML-escaped.
 * @param {TemplateStringsArray} strings
 * @param {...any} values
 * @returns {string}
 */
function html(strings) {
  var esc =
    globalThis.ChimeraUI && globalThis.ChimeraUI.escapeHtml
      ? globalThis.ChimeraUI.escapeHtml
      : function (s) {
          return String(s);
        };
  var out = "";
  for (var i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < arguments.length - 1) {
      out += esc(arguments[i + 1]);
    }
  }
  return out;
}

globalThis.ChimeraUI = globalThis.ChimeraUI || {};
globalThis.ChimeraUI.html = html;
