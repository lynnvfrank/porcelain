/**
 * @param {{text: string, title?: string, variant?: string}} model
 * @returns {string}
 */
function Badge(model) {
  model = model || {};
  var esc = globalThis.ChimeraUI && globalThis.ChimeraUI.escapeHtml ? globalThis.ChimeraUI.escapeHtml : function (s) { return String(s); };
  var escA = globalThis.ChimeraUI && globalThis.ChimeraUI.escapeAttr ? globalThis.ChimeraUI.escapeAttr : esc;
  var txt = model.text != null ? String(model.text) : "";
  var title = model.title != null ? String(model.title) : "";
  var v = model.variant != null ? String(model.variant) : "neutral";
  var cls = "sum-svc-badge";
  if (v === "svc-chimera-vectorstore") cls += " sum-svc-chimera-vectorstore";
  else if (v === "svc-chimera-indexer") cls += " sum-svc-chimera-indexer";
  else if (v === "svc-chimera-broker") cls += " sum-svc-broker";
  else if (v === "svc-chimera-gateway") cls += " sum-svc-chimera-gateway";
  else if (v === "error") cls += " sum-svc-broker-filled";
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

globalThis.ChimeraUI = globalThis.ChimeraUI || {};
globalThis.ChimeraUI.Badge = Badge;
