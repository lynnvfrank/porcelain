/**
 * Summarized feed card shell (details.sum-card).
 */

function escA() {
  return globalThis.ChimeraUI && globalThis.ChimeraUI.escapeAttr
    ? globalThis.ChimeraUI.escapeAttr
    : function (s) {
        return String(s);
      };
}

/**
 * @param {{summaryHtml: string, bodyHtml?: string, className?: string, attrs?: Record<string,string>, open?: boolean, testId?: string}} model
 * @returns {string}
 */
function renderDetails(model) {
  model = model || {};
  var cls = "sum-card";
  if (model.className) cls += " " + String(model.className);
  var attrs = model.attrs && typeof model.attrs === "object" ? model.attrs : {};
  var attrStr = "";
  for (var k in attrs) {
    if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
    attrStr += " " + k + '="' + escA()(attrs[k]) + '"';
  }
  if (model.testId) attrStr += ' data-testid="' + escA()(model.testId) + '"';
  if (model.open) attrStr += " open";
  var body = model.bodyHtml != null ? String(model.bodyHtml) : "";
  var bodyBlock = body ? '<div class="sum-body">' + body + "</div>" : "";
  return (
    "<details" +
    attrStr +
    ' class="' +
    escA()(cls) +
    '"><summary>' +
    (model.summaryHtml != null ? model.summaryHtml : "") +
    "</summary>" +
    bodyBlock +
    "</details>"
  );
}

globalThis.ChimeraUI = globalThis.ChimeraUI || {};
globalThis.ChimeraUI.Card = { renderDetails: renderDetails };
