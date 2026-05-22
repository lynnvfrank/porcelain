/**
 * Health / strip segment helpers — colors from CSS vars (--embed-strip-* in theme-tokens.css).
 */
(function (global) {
  "use strict";

  var TONES = { up: true, down: true, key_missing: true, unknown: true };

  function normalizeTone(tone) {
    var t = String(tone || "unknown").trim().toLowerCase();
    return TONES[t] ? t : "unknown";
  }

  function healthSegClass(tone) {
    return "sum-bf-prov-health-seg sum-bf-prov-health-seg--" + normalizeTone(tone);
  }

  /**
   * @param {string} title
   * @param {string} tone
   * @param {string=} extraClass
   * @returns {string}
   */
  function healthSegSpan(title, tone, extraClass) {
    var cls = healthSegClass(tone);
    if (extraClass) {
      cls += " " + String(extraClass).trim();
    }
    var esc =
      global.ChimeraUI && global.ChimeraUI.escapeAttr
        ? global.ChimeraUI.escapeAttr
        : function (s) {
            return String(s);
          };
    return (
      '<span class="' +
      esc(cls) +
      '" title="' +
      esc(title != null ? title : "") +
      '"></span>'
    );
  }

  global.ChimeraUI = global.ChimeraUI || {};
  global.ChimeraUI.embedStripToneClass = healthSegClass;
  global.ChimeraUI.healthSegSpan = healthSegSpan;
})(typeof globalThis !== "undefined" ? globalThis : window);
