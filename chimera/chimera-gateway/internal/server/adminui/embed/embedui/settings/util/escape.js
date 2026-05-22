/**
 * Re-export canonical escape helpers from ChimeraUI (loaded via ui/util/escape.js in settings.html).
 */
globalThis.ChimeraSettings = globalThis.ChimeraSettings || {};
if (globalThis.ChimeraUI && globalThis.ChimeraUI.escapeHtml) {
  globalThis.ChimeraSettings.escapeHtml = globalThis.ChimeraUI.escapeHtml;
  globalThis.ChimeraSettings.escapeAttr = globalThis.ChimeraUI.escapeAttr;
} else {
  // Fallback when ui/util/escape.js did not load (tests may load this file alone).
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
  globalThis.ChimeraSettings.escapeHtml = escapeHtml;
  globalThis.ChimeraSettings.escapeAttr = escapeHtml;
}
