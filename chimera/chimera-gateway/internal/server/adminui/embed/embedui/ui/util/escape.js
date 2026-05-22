/**
 * HTML escaping for embed UI (canonical; also mirrored on ChimeraSettings).
 * @param {any} s
 * @returns {string}
 */
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  var str = String(s);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * @param {any} s
 * @returns {string}
 */
function escapeAttr(s) {
  return escapeHtml(s);
}

globalThis.ChimeraUI = globalThis.ChimeraUI || {};
globalThis.ChimeraUI.escapeHtml = escapeHtml;
globalThis.ChimeraUI.escapeAttr = escapeAttr;

globalThis.ChimeraSettings = globalThis.ChimeraSettings || {};
globalThis.ChimeraSettings.escapeHtml = escapeHtml;
globalThis.ChimeraSettings.escapeAttr = escapeAttr;
