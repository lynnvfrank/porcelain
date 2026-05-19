/**
 * HTTP and log-level pills (shared across raw table, headlines, event log).
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
 * @param {number|string} code
 * @returns {string}
 */
function httpStatusClass(code) {
  var sc = Number(code);
  if (isNaN(sc)) return "pill-4xx";
  if (sc >= 500) return "pill-5xx";
  if (sc >= 400) return "pill-4xx";
  return "pill-2xx";
}

/**
 * @param {number|string} code
 * @param {{asChip?: boolean}=} opts 304 defaults to chip styling in event log
 * @returns {string}
 */
function renderHttpStatus(code, opts) {
  opts = opts || {};
  var sc = Number(code);
  if (isNaN(sc)) return "";
  var text = esc()(String(sc));
  if (opts.asChip || sc === 304) {
    return '<span class="chip">' + text + "</span>";
  }
  return '<span class="' + escA()(httpStatusClass(sc)) + '">' + text + "</span>";
}

/**
 * @param {string} levelKey uppercased level or _NONE
 * @returns {string}
 */
function renderEvlogLevel(levelKey) {
  var lk = levelKey == null ? "" : String(levelKey).trim().toUpperCase();
  if (lk === "TRACE") {
    return '<span class="sum-evlog-status__pill sum-evlog-status__lvl--TRACE">TRACE</span>';
  }
  if (lk === "WARN") {
    return '<span class="sum-evlog-status__pill sum-evlog-status__lvl--WARN">WARN</span>';
  }
  if (lk === "ERROR") {
    return '<span class="sum-evlog-status__pill sum-evlog-status__lvl--ERROR">ERROR</span>';
  }
  return "";
}

/**
 * @param {string} text
 * @param {string} className
 * @returns {string}
 */
function renderText(text, className) {
  return '<span class="' + escA()(className) + '">' + esc()(text) + "</span>";
}

globalThis.ChimeraUI = globalThis.ChimeraUI || {};
globalThis.ChimeraUI.Pill = {
  httpStatusClass: httpStatusClass,
  renderHttpStatus: renderHttpStatus,
  renderEvlogLevel: renderEvlogLevel,
  renderText: renderText
};
