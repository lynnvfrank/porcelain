/**
 * Summarized feed card render (Phase 3 extraction).
 * Registers builders on ctx during ChimeraSettings.Render.Cards.mount*.
 */
globalThis.ChimeraSettings = globalThis.ChimeraSettings || {};
globalThis.ChimeraSettings.Render = globalThis.ChimeraSettings.Render || {};
globalThis.ChimeraSettings.Render.Cards = globalThis.ChimeraSettings.Render.Cards || {};

globalThis.ChimeraSettings.Render.Cards.mountWorkspaceDraft = function (ctx) {
  var escapeHtml = ctx.escapeHtml;
  var resolveLogsOperatorUserLabel =
    typeof ctx.resolveLogsOperatorUserLabel === "function"
      ? ctx.resolveLogsOperatorUserLabel
      : function () {
          return "—";
        };

  function syncWorkspaceDraftHeader(cardEl, d) {
    if (!cardEl || !d) return;
    var u = cardEl.querySelector(".ws-draft-lbl-user");
    var p = cardEl.querySelector(".ws-draft-lbl-proj");
    var f = cardEl.querySelector(".ws-draft-lbl-flav");
    var ulab = resolveLogsOperatorUserLabel();
    if (u) u.textContent = ulab !== "—" ? ulab : "";
    if (p) p.textContent = String(d.projectId != null ? d.projectId : "").trim();
    if (f) f.textContent = String(d.flavorId != null ? d.flavorId : "").trim();
  }

  function buildWorkspaceDraftCardHtml(d) {
    var uid = "ws-draft-" + d.id;
    var ulab = resolveLogsOperatorUserLabel();
    var projShown = String(d.projectId != null ? d.projectId : "").trim();
    var flavShown = String(d.flavorId != null ? d.flavorId : "").trim();
    var titleBits =
      '<span class="ws-draft-head-inline">' +
      '<span class="ws-draft-lbl ws-draft-lbl-user">' +
      (ulab !== "—" ? escapeHtml(ulab) : "") +
      "</span>" +
      '<span class="ws-draft-sep muted">·</span>' +
      '<span class="ws-draft-lbl ws-draft-lbl-proj">' +
      escapeHtml(projShown) +
      "</span>" +
      '<span class="ws-draft-sep muted">·</span>' +
      '<span class="ws-draft-lbl ws-draft-lbl-flav">' +
      escapeHtml(flavShown) +
      "</span>" +
      "</span>";
    var paths = d.paths && d.paths.length ? d.paths : [];
    var rmDisabledAttr = paths.length ? "" : " disabled";
    var selOpts = "";
    for (var pi = 0; pi < paths.length; pi++) {
      selOpts +=
        '<option value="' +
        pi +
        '">' +
        escapeHtml(paths[pi]) +
        "</option>";
    }
    var prVal = escapeHtml(String(d.projectId != null ? d.projectId : ""));
    var fvVal = escapeHtml(String(d.flavorId != null ? d.flavorId : ""));
    return (
      '<article class="sum-card sum-card--workspace-draft" id="' +
      escapeHtml(uid) +
      '" data-workspace-draft="' +
      String(d.id) +
      '">' +
      '<header class="sum-card__workspace-draft-hdr">' +
      '<span class="sum-avatar sum-av-c" title="New workspace">+</span>' +
      '<span class="sum-main sum-main--workspace-draft">' +
      '<span class="sum-title">' +
      titleBits +
      "</span>" +
      "</span>" +
      '<span class="ws-draft-actions">' +
      '<button type="button" class="sg-op-btn sg-op-btn--ghost ws-draft-btn-cancel">Cancel</button>' +
      '<button type="button" class="sg-op-btn ws-draft-btn-save">Save</button>' +
      "</span>" +
      "</header>" +
      '<div class="sum-body">' +
      '<div class="ws-draft-fields">' +
      '<div class="ws-draft-field">' +
      '<label class="ws-draft-field-label" for="' +
      escapeHtml(uid) +
      '-pr">Project id</label>' +
      '<input id="' +
      escapeHtml(uid) +
      '-pr" class="ws-draft-input" type="text" autocomplete="off" data-ws-field="project" value="' +
      prVal +
      '" />' +
      "</div>" +
      '<div class="ws-draft-field">' +
      '<label class="ws-draft-field-label" for="' +
      escapeHtml(uid) +
      '-fv">Flavor id</label>' +
      '<input id="' +
      escapeHtml(uid) +
      '-fv" class="ws-draft-input" type="text" autocomplete="off" data-ws-field="flavor" value="' +
      fvVal +
      '" />' +
      "</div>" +
      "</div>" +
      '<div class="sum-section-label">Watched paths</div>' +
      '<div class="ws-draft-paths-row">' +
      '<select class="ws-draft-paths-select" size="6" aria-label="Watched paths" data-ws-draft-paths="' +
      String(d.id) +
      '">' +
      selOpts +
      "</select>" +
      '<div class="ws-draft-path-btns">' +
      '<button type="button" class="sg-op-btn sg-op-btn--ghost ws-draft-btn-add">Add</button>' +
      '<button type="button" class="sg-op-btn sg-op-btn--ghost ws-draft-btn-remove"' +
      rmDisabledAttr +
      ">Remove</button>" +
      "</div>" +
      "</div>" +
      '<p class="muted ws-draft-hint">Folder picker requires the Chimera desktop shell (or an environment that exposes <code>chimeraPickFolder</code>).</p>' +
      "</div>" +
      "</article>"
    );
  }

  ctx.buildWorkspaceDraftCardHtml = buildWorkspaceDraftCardHtml;
  ctx.syncWorkspaceDraftHeader = syncWorkspaceDraftHeader;
};
