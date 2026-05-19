/**
 * Shared button primitives (.btn from ui.css and admin .sg-op-btn).
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
 * @param {{label: string, variant?: string, type?: string, className?: string, attrs?: Record<string,string>, disabled?: boolean}} model
 * @returns {string}
 */
function render(model) {
  model = model || {};
  var label = model.label != null ? String(model.label) : "";
  var variant = model.variant != null ? String(model.variant) : "";
  var type = model.type != null ? String(model.type) : "button";
  var extra = model.className != null ? String(model.className) : "";
  var cls = "btn";
  if (variant === "primary") cls += " btn--primary";
  else if (variant === "ghost") cls = "sg-op-btn sg-op-btn--ghost";
  else if (variant === "danger") cls = "sg-op-btn sg-op-btn--danger";
  else if (variant === "admin") cls = "sg-op-btn";
  if (extra) cls += " " + extra;
  var attrs = model.attrs && typeof model.attrs === "object" ? model.attrs : {};
  var attrStr = ' type="' + escA()(type) + '"';
  for (var k in attrs) {
    if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
    attrStr += " " + k + '="' + escA()(attrs[k]) + '"';
  }
  if (model.disabled) attrStr += ' disabled aria-disabled="true"';
  return "<button" + attrStr + ' class="' + escA()(cls) + '">' + esc()(label) + "</button>";
}

globalThis.ChimeraUI = globalThis.ChimeraUI || {};
globalThis.ChimeraUI.Button = { render: render };
