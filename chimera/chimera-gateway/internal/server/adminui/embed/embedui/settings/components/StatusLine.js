/**
 * Small status-line wrapper used by the transport layer.
 *
 * Exports:
 * - ChimeraSettings.StatusLine(el) -> { el, set(text, cls?), get() }
 */

function StatusLine(el) {
  return {
    el: el || null,
    set: function (text, cls) {
      if (!el) return;
      el.textContent = text == null ? "" : String(text);
      if (cls != null) el.className = String(cls);
    },
    get: function () {
      if (!el) return "";
      return String(el.textContent || "");
    }
  };
}

globalThis.ChimeraSettings = globalThis.ChimeraSettings || {};
globalThis.ChimeraSettings.StatusLine = StatusLine;

