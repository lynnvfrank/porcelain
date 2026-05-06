/**
 * @param {{text: string, title?: string, variant?: string}} model
 * @returns {string}
 */
function Badge(model) {
  model = model || {};
  var txt = model.text != null ? String(model.text) : "";
  var title = model.title != null ? String(model.title) : "";
  var v = model.variant != null ? String(model.variant) : "neutral";
  var cls = "sum-svc-badge";
  // Keep mapping small; extend later as needed.
  if (v === "svc-qdrant") cls += " sum-svc-qdrant";
  else if (v === "svc-indexer") cls += " sum-svc-indexer";
  else if (v === "svc-bifrost") cls += " sum-svc-upstream";
  else if (v === "svc-gateway") cls += " sum-svc-gateway";
  else if (v === "error") cls += " sum-svc-upstream-filled";
  var esc = globalThis.ClaudiaLogs && globalThis.ClaudiaLogs.escapeHtml ? globalThis.ClaudiaLogs.escapeHtml : function (s) { return String(s); };
  var escA = globalThis.ClaudiaLogs && globalThis.ClaudiaLogs.escapeAttr ? globalThis.ClaudiaLogs.escapeAttr : function (s) { return String(s); };
  return (
    '<span class="' +
    escA(cls) +
    '"' +
    (title ? ' title="' + escA(title) + '"' : "") +
    ">" +
    esc(txt) +
    "</span>"
  );
}

globalThis.ClaudiaLogs = globalThis.ClaudiaLogs || {};
globalThis.ClaudiaLogs.Badge = Badge;

