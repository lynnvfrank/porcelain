/**
 * Admin YAML editor chrome (.sg-op-yaml-wrap).
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
 * @param {{id: string, value: string, dirty?: boolean, full?: boolean, rows?: number, overlayHtml?: string}} model
 * @returns {string}
 */
function render(model) {
  model = model || {};
  var id = model.id != null ? String(model.id) : "yaml-editor";
  var value = model.value != null ? String(model.value) : "";
  var wrapCls = "sg-op-yaml-wrap";
  if (model.full) wrapCls += " sg-op-yaml-wrap--full";
  if (model.dirty) wrapCls += " sg-op-yaml-wrap--dirty";
  var rows = model.rows != null ? model.rows : 10;
  var overlay = model.overlayHtml != null ? String(model.overlayHtml) : "";
  return (
    '<div id="' +
    escA()(id) +
    '-wrap" class="' +
    escA()(wrapCls) +
    '">' +
    '<textarea id="' +
    escA()(id) +
    '" class="sg-op-yaml-textarea" rows="' +
    escA()(String(rows)) +
    '" spellcheck="false">' +
    esc(value) +
    "</textarea>" +
    '<div class="sg-op-yaml-ov">' +
    overlay +
    "</div></div>"
  );
}

globalThis.ChimeraUI = globalThis.ChimeraUI || {};
globalThis.ChimeraUI.YamlEditorPanel = { render: render };
