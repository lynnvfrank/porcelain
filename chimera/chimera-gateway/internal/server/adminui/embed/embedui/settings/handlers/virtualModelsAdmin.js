/**
 * Virtual model card actions (per-model routing stack).
 * Exports: ChimeraSettings.Handlers.VirtualModels.wire(ctx)
 */
globalThis.ChimeraSettings = globalThis.ChimeraSettings || {};
globalThis.ChimeraSettings.Handlers = globalThis.ChimeraSettings.Handlers || {};
globalThis.ChimeraSettings.Handlers.VirtualModels = globalThis.ChimeraSettings.Handlers.VirtualModels || {};

globalThis.ChimeraSettings.Handlers.VirtualModels.wire = function (ctx) {
  var adminPostJSON = ctx.adminPostJSON;
  var adminPutJSON = ctx.adminPutJSON;
  var adminSetMessage = ctx.adminSetMessage;
  var fetchAdminState = ctx.fetchAdminState;
  var fetchAdminTokens = ctx.fetchAdminTokens;
  var parseFallbackChainInput = ctx.parseFallbackChainInput;
  var fallbackChainToYAML = ctx.fallbackChainToYAML;
  var refreshSummarizedPanel = ctx.refreshSummarizedPanel;
  var forceSummarizedFullRebuild = ctx.forceSummarizedFullRebuild;
  var removeVirtualModelFromSummarizedFeed = ctx.removeVirtualModelFromSummarizedFeed;
  var fetchVirtualModelDetail = ctx.fetchVirtualModelDetail;
  var patchVirtualModelCard = ctx.patchVirtualModelCard;
  var syncVirtualModelCardHeader = ctx.syncVirtualModelCardHeader;
  var syncVirtualModelDraftCardChrome = ctx.syncVirtualModelDraftCardChrome;
  var buildVirtualModelDraftCardHtml = ctx.buildVirtualModelDraftCardHtml;
  var scheduleStoryRebuild = ctx.scheduleStoryRebuild;

  var AA = globalThis.ChimeraShared && globalThis.ChimeraShared.AdminAction;
  var CE = globalThis.ChimeraShared && globalThis.ChimeraShared.ConfigureEdit;
  var YE = globalThis.ChimeraShared && globalThis.ChimeraShared.YamlEditor;

  function runVmJson(opts) {
    if (AA && typeof AA.runJson === "function") return AA.runJson(opts);
    return opts.request().then(opts.onSuccess).catch(function (e) {
      if (typeof opts.setMessage === "function") {
        opts.setMessage("err", e && e.message ? e.message : String(e));
      }
    });
  }

  function vmIdFromEl(t) {
    return Number(String(t.getAttribute("data-vm-id") || "").trim());
  }

  function vmUi(id) {
    var key = String(id);
    if (!ctx.virtualModelUi) ctx.virtualModelUi = {};
    if (!ctx.virtualModelUi[key]) {
      ctx.virtualModelUi[key] = {
        panelOpen: false,
        hydrated: false,
        detailLoading: false,
        identityEditing: false,
        fallbackEditing: false,
        routingEditing: false,
        routerEditing: false,
        fallbackTouched: false,
        fallbackDraft: null,
        policyTouched: false,
        routerModelsTouched: false,
        routerThresholdTouched: false,
        routerEnabledTouched: false,
        policyDraft: null,
        routerModelsDraft: null,
        routerThresholdDraft: null,
        routerEnabledDraft: null,
        sectionOpen: { identity: true, fallback: true }
      };
    }
    return ctx.virtualModelUi[key];
  }

  function vmSectionKeepOpen(ui, sectionKey) {
    if (!ui.sectionOpen) ui.sectionOpen = { identity: true, fallback: true };
    ui.sectionOpen[sectionKey] = true;
  }

  function vmCardEl(vmId) {
    return document.getElementById("virtual-model-" + String(vmId));
  }

  function vmPanelOpen(vmId) {
    var el = vmCardEl(vmId);
    return !!(el && el.open);
  }

  function vmDetail(id) {
    if (!ctx.virtualModelDetails) return null;
    return ctx.virtualModelDetails[String(id)] || null;
  }

  function reloadVm(vmId) {
    var ui = vmUi(vmId);
    ui.hydrated = false;
    return Promise.all([
      fetchVirtualModelDetail(vmId, true),
      fetchAdminState(),
      fetchAdminTokens()
    ]).then(function () {
      patchVm(vmId, { onlyIfOpen: false });
      if (typeof ctx.patchAdminCardsFromPoll === "function") ctx.patchAdminCardsFromPoll();
    });
  }

  function patchVm(vmId, opts) {
    if (typeof patchVirtualModelCard === "function" && patchVirtualModelCard(vmId, opts)) return;
    refreshSummarizedPanel();
  }

  function vmIdentityPutBody(vmId, overrides) {
    overrides = overrides || {};
    var det = vmDetail(vmId) || {};
    var pfx = "vm-" + String(vmId) + "-";
    var nameEl = document.getElementById(pfx + "name");
    var verEl = document.getElementById(pfx + "version");
    var descEl = document.getElementById(pfx + "description");
    var visEl = document.getElementById(pfx + "visibility-toggle");
    var enEl = document.getElementById(pfx + "enabled-toggle");
    var name = nameEl
      ? String(nameEl.value || "").trim()
      : String(overrides.name != null ? overrides.name : det.name != null ? det.name : "").trim();
    var version = verEl
      ? String(verEl.value || "").trim()
      : String(overrides.version != null ? overrides.version : det.version != null ? det.version : "").trim();
    var description = descEl
      ? String(descEl.value || "").trim()
      : String(
          overrides.description != null ? overrides.description : det.description != null ? det.description : ""
        ).trim();
    var visibility =
      overrides.visibility != null
        ? String(overrides.visibility)
        : visEl
          ? String(visEl.getAttribute("aria-pressed") || "").toLowerCase() === "true"
            ? "public"
            : "private"
          : String(det.visibility || "public");
    var enabled =
      overrides.enabled != null
        ? !!overrides.enabled
        : !!(enEl && String(enEl.getAttribute("aria-pressed") || "").toLowerCase() === "true");
    return {
      name: name,
      version: version,
      description: description,
      visibility: visibility,
      enabled: enabled
    };
  }

  function lookupVmDraft(draftId) {
    if (!ctx.virtualModelDrafts) return null;
    for (var i = 0; i < ctx.virtualModelDrafts.length; i++) {
      if (ctx.virtualModelDrafts[i] && String(ctx.virtualModelDrafts[i].id) === String(draftId)) {
        return ctx.virtualModelDrafts[i];
      }
    }
    return null;
  }

  function syncVmDraftChromeFromDom(draftId) {
    var card = document.getElementById("virtual-model-draft-" + String(draftId));
    var draft = lookupVmDraft(draftId);
    if (!card || !draft || typeof syncVirtualModelDraftCardChrome !== "function") return;
    syncVirtualModelDraftCardChrome(card, draft);
  }

  function patchVmDraftCard(draftId) {
    if (!ctx.virtualModelDrafts || typeof buildVirtualModelDraftCardHtml !== "function") return false;
    var draft = lookupVmDraft(draftId);
    if (!draft || typeof ctx.replaceCardById !== "function") return false;
    return ctx.replaceCardById(
      "virtual-model-draft-" + String(draftId),
      function () {
        return buildVirtualModelDraftCardHtml(draft);
      },
      { preserveOpen: false }
    );
  }

  function refreshVmDraftUi() {
    var patched = false;
    if (ctx.virtualModelDrafts && ctx.virtualModelDrafts.length) {
      for (var i = 0; i < ctx.virtualModelDrafts.length; i++) {
        if (ctx.virtualModelDrafts[i] && patchVmDraftCard(ctx.virtualModelDrafts[i].id)) patched = true;
      }
    }
    if (!patched && typeof scheduleStoryRebuild === "function") scheduleStoryRebuild();
    else if (!patched) refreshSummarizedPanel();
  }

  function vmApiPath(vmId, suffix) {
    return "/api/ui/virtual-models/" + String(vmId) + (suffix || "");
  }

  function lookupVmSummary(vmId) {
    var gw = ctx.adminStateCache && ctx.adminStateCache.gateway;
    var vms = gw && gw.virtual_models && Array.isArray(gw.virtual_models) ? gw.virtual_models : [];
    for (var i = 0; i < vms.length; i++) {
      if (vms[i] && Number(vms[i].id) === Number(vmId)) return vms[i];
    }
    return null;
  }

  function vmHeaderFieldsFromDom(vmId) {
    var pfx = "vm-" + String(vmId) + "-";
    var summary = lookupVmSummary(vmId) || {};
    var det = vmDetail(vmId) || {};
    var nameEl = document.getElementById(pfx + "name");
    var versionEl = document.getElementById(pfx + "version");
    var descEl = document.getElementById(pfx + "description");
    var visEl = document.getElementById(pfx + "visibility");
    var enabledEl = document.getElementById(pfx + "enabled");
    return {
      model_id: det.model_id != null ? det.model_id : summary.model_id,
      name: nameEl ? String(nameEl.value || "") : det.name != null ? det.name : summary.name,
      version: versionEl ? String(versionEl.value || "") : det.version != null ? det.version : summary.version,
      description: descEl
        ? String(descEl.value || "")
        : det.description != null
          ? det.description
          : summary.description,
      visibility: visEl
        ? String(visEl.value || "public")
        : det.visibility != null
          ? det.visibility
          : summary.visibility,
      enabled: enabledEl ? !!enabledEl.checked : !!(det.enabled != null ? det.enabled : summary.enabled),
      tool_router_enabled: !!(det.tool_router_enabled != null ? det.tool_router_enabled : summary.tool_router_enabled)
    };
  }

  function syncVmHeaderFromDom(vmId) {
    var card = vmCardEl(vmId);
    if (!card || typeof syncVirtualModelCardHeader !== "function") return;
    syncVirtualModelCardHeader(card, vmHeaderFieldsFromDom(vmId));
  }

  if (!globalThis.__ChimeraSettingsVirtualModelsUiWired) {
    globalThis.__ChimeraSettingsVirtualModelsUiWired = true;

    document.body.addEventListener("toggle", function (ev) {
      var det = ev.target;
      if (!det || det.tagName !== "DETAILS" || !det.classList || !det.classList.contains("sum-card--virtual-model")) {
        return;
      }
      var vmId = Number(String(det.getAttribute("data-virtual-model-id") || "").trim());
      if (!vmId) return;
      var ui = vmUi(vmId);
      if (!det.open) {
        ui.panelOpen = false;
        return;
      }
      ui.panelOpen = true;
      if (ui.hydrated && ctx.virtualModelDetails && ctx.virtualModelDetails[String(vmId)]) {
        return;
      }
      if (typeof fetchVirtualModelDetail !== "function") return;
      fetchVirtualModelDetail(vmId, false)
        .then(function () {
          if (!ui.panelOpen || !vmPanelOpen(vmId)) return;
          patchVm(vmId, { onlyIfOpen: true });
        })
        .catch(function (e) {
          if (!ui.panelOpen || !vmPanelOpen(vmId)) return;
          adminSetMessage("err", e && e.message ? e.message : String(e));
        });
    }, true);

    document.body.addEventListener("toggle", function (ev) {
      var det = ev.target;
      if (!det || det.tagName !== "DETAILS" || !det.classList || !det.classList.contains("sum-vm-section")) {
        return;
      }
      var card = det.closest && det.closest(".sum-card--virtual-model");
      if (!card) return;
      var vmId = Number(String(card.getAttribute("data-virtual-model-id") || "").trim());
      if (!vmId) return;
      var key = String(det.getAttribute("data-vm-section") || "").trim();
      if (!key) return;
      var ui = vmUi(vmId);
      if (!ui.sectionOpen) ui.sectionOpen = { identity: true, fallback: true };
      ui.sectionOpen[key] = !!det.open;
    }, true);

    document.body.addEventListener(
      "input",
      function (ev) {
        var t = ev.target;
        if (!t) return;
        var draftField = t.getAttribute && t.getAttribute("data-vm-draft-field");
        if (draftField) {
          var draftId = Number(String(t.getAttribute("data-vm-draft-id") || "").trim());
          if (!draftId || !ctx.virtualModelDrafts) return;
          for (var di = 0; di < ctx.virtualModelDrafts.length; di++) {
            if (ctx.virtualModelDrafts[di] && Number(ctx.virtualModelDrafts[di].id) === draftId) {
              ctx.virtualModelDrafts[di][draftField] =
                t.tagName === "SELECT" ? String(t.value || "") : String(t.value != null ? t.value : "");
              syncVmDraftChromeFromDom(draftId);
              break;
            }
          }
          return;
        }
        if (!t.id) return;
        var m = String(t.id).match(/^vm-(\d+)-(name|version|description)$/);
        if (!m) return;
        syncVmHeaderFromDom(Number(m[1]));
        var yamlM = String(t.id).match(/^vm-(\d+)-(fallback-yaml-ta|routing-yaml-ta|router-yaml-ta)$/);
        if (yamlM && YE && typeof YE.applyTextareaInputDirty === "function") {
          var vmIdYaml = Number(yamlM[1]);
          var uiYaml = vmUi(vmIdYaml);
          var field = yamlM[2];
          YE.applyTextareaInputDirty(t, {
            ui: uiYaml,
            onDirty: function (ui, el) {
              if (field === "fallback-yaml-ta") {
                ui.fallbackTouched = true;
                ui.fallbackDraft = el.value != null ? String(el.value) : "";
              } else if (field === "routing-yaml-ta") {
                ui.policyTouched = true;
                ui.policyDraft = el.value != null ? String(el.value) : "";
              } else if (field === "router-yaml-ta") {
                ui.routerModelsTouched = true;
                ui.routerModelsDraft = el.value != null ? String(el.value) : "";
              }
            }
          });
        }
      },
      true
    );

    document.body.addEventListener(
      "change",
      function (ev) {
        var t = ev.target;
        if (!t || !t.id) return;
        var m = String(t.id).match(/^vm-(\d+)-(visibility|enabled)$/);
        if (!m) return;
        syncVmHeaderFromDom(Number(m[1]));
      },
      true
    );

    document.body.addEventListener("click", function (ev) {
      var t = ev.target;
      if (!t || typeof t.closest !== "function") return;
      var actionEl = t.closest("[data-admin-action]");
      if (!actionEl || typeof actionEl.getAttribute !== "function") return;
      var act = actionEl.getAttribute("data-admin-action");
      if (!act || act.indexOf("vm-") !== 0) return;
      t = actionEl;

      if (act === "vm-add") {
        if (ctx.virtualModelDrafts && ctx.virtualModelDrafts.length > 0) {
          adminSetMessage("err", "Finish or cancel the current draft virtual model first.");
          return;
        }
        if (!ctx.virtualModelDrafts) ctx.virtualModelDrafts = [];
        var nextId = ctx.nextVirtualModelDraftId != null ? Number(ctx.nextVirtualModelDraftId) : 1;
        ctx.nextVirtualModelDraftId = nextId + 1;
        ctx.virtualModelDrafts.unshift({
          id: nextId,
          name: "",
          version: "",
          description: "",
          model_id: "",
          saving: false,
          msg: ""
        });
        adminSetMessage("", "");
        if (typeof scheduleStoryRebuild === "function") scheduleStoryRebuild();
        else refreshSummarizedPanel();
        return;
      }

      if (act === "vm-draft-cancel") {
        var dCancel = Number(String(t.getAttribute("data-vm-draft-id") || "").trim());
        if (!dCancel) return;
        var kept = [];
        for (var dc = 0; dc < (ctx.virtualModelDrafts || []).length; dc++) {
          if (!ctx.virtualModelDrafts[dc] || Number(ctx.virtualModelDrafts[dc].id) !== dCancel) {
            kept.push(ctx.virtualModelDrafts[dc]);
          }
        }
        ctx.virtualModelDrafts = kept;
        adminSetMessage("", "");
        if (typeof scheduleStoryRebuild === "function") scheduleStoryRebuild();
        else refreshSummarizedPanel();
        return;
      }

      if (act === "vm-draft-save") {
        var dSave = Number(String(t.getAttribute("data-vm-draft-id") || "").trim());
        if (!dSave) return;
        var draftSave = null;
        for (var ds = 0; ds < (ctx.virtualModelDrafts || []).length; ds++) {
          if (ctx.virtualModelDrafts[ds] && Number(ctx.virtualModelDrafts[ds].id) === dSave) {
            draftSave = ctx.virtualModelDrafts[ds];
            break;
          }
        }
        if (!draftSave) return;
        var saveName = String(draftSave.name || "").trim();
        var saveVersion = String(draftSave.version || "").trim();
        if (!saveName || !saveVersion) {
          draftSave.msg = "Name and version are required.";
          patchVmDraftCard(dSave);
          adminSetMessage("err", draftSave.msg);
          return;
        }
        draftSave.saving = true;
        draftSave.msg = "";
        patchVmDraftCard(dSave);
        var createBody = {
          name: saveName,
          version: saveVersion,
          description: String(draftSave.description || "").trim(),
          visibility: "public"
        };
        var customMid = String(draftSave.model_id || "").trim();
        if (customMid) createBody.model_id = customMid;
        (adminPostJSON || adminPutJSON)("/api/ui/virtual-models", createBody)
          .then(function () {
            var keepSave = [];
            for (var di2 = 0; di2 < (ctx.virtualModelDrafts || []).length; di2++) {
              if (!ctx.virtualModelDrafts[di2] || Number(ctx.virtualModelDrafts[di2].id) !== dSave) {
                keepSave.push(ctx.virtualModelDrafts[di2]);
              }
            }
            ctx.virtualModelDrafts = keepSave;
            adminSetMessage("", "Virtual model created.");
            return Promise.all([
              typeof fetchAdminState === "function" ? fetchAdminState() : Promise.resolve(),
              typeof fetchAdminTokens === "function" ? fetchAdminTokens() : Promise.resolve()
            ]);
          })
          .then(function () {
            if (typeof scheduleStoryRebuild === "function") scheduleStoryRebuild();
            else refreshSummarizedPanel();
          })
          .catch(function (e) {
            draftSave.saving = false;
            draftSave.msg = e && e.message ? e.message : String(e);
            patchVmDraftCard(dSave);
            adminSetMessage("err", draftSave.msg);
          });
        return;
      }

      var vmId = vmIdFromEl(t);
      if (!vmId) return;
      ev.stopPropagation();
      var ui = vmUi(vmId);
      var det = vmDetail(vmId);
      var pfx = "vm-" + String(vmId) + "-";

      ev.preventDefault();

      if (act === "vm-identity-configure") {
        vmSectionKeepOpen(ui, "identity");
        ui.identityEditing = true;
        patchVm(vmId);
        return;
      }
      if (act === "vm-identity-cancel") {
        vmSectionKeepOpen(ui, "identity");
        ui.identityEditing = false;
        patchVm(vmId);
        return;
      }
      if (act === "vm-identity-delete") {
        var vmSummary = lookupVmSummary(vmId) || det || {};
        var vmLabel = String(vmSummary.model_id || vmSummary.name || "").trim();
        var confirmMsg =
          "Delete this virtual model" +
          (vmLabel ? ' "' + vmLabel + '"' : "") +
          " from configuration? Clients will no longer be able to route through it.";
        if (!window.confirm(confirmMsg)) {
          return;
        }
        fetch(vmApiPath(vmId), { method: "DELETE", credentials: "same-origin" })
          .then(function (res) {
            if (res.ok || res.status === 204) return;
            return res.text().then(function (txt) {
              throw new Error((txt && String(txt).trim()) || res.statusText || "delete failed");
            });
          })
          .then(function () {
            adminSetMessage("", "Virtual model removed.");
            if (typeof removeVirtualModelFromSummarizedFeed === "function") {
              removeVirtualModelFromSummarizedFeed(vmId);
            } else {
              if (ctx.virtualModelDetails) delete ctx.virtualModelDetails[String(vmId)];
              if (ctx.virtualModelUi) delete ctx.virtualModelUi[String(vmId)];
            }
            if (document.activeElement && document.activeElement.blur) {
              try {
                document.activeElement.blur();
              } catch (_eVmDelBlur) {}
            }
            return fetchAdminState();
          })
          .then(function () {
            if (typeof forceSummarizedFullRebuild === "function") {
              forceSummarizedFullRebuild("vm-deleted");
            } else {
              refreshSummarizedPanel();
            }
          })
          .catch(function (e) {
            adminSetMessage("err", e && e.message ? e.message : String(e));
          });
        return;
      }

      if (act === "vm-fallback-configure") {
        vmSectionKeepOpen(ui, "fallback");
        ui.fallbackEditing = true;
        patchVm(vmId);
        return;
      }
      if (act === "vm-fallback-cancel") {
        vmSectionKeepOpen(ui, "fallback");
        if (CE && typeof CE.restoreEditOnCancel === "function") {
          CE.restoreEditOnCancel(ui, {
            editingKey: "fallbackEditing",
            touchedKey: "fallbackTouched",
            draftKey: "fallbackDraft",
            onAfter: function () {
              patchVm(vmId);
            }
          });
        } else {
          ui.fallbackEditing = false;
          ui.fallbackTouched = false;
          ui.fallbackDraft = null;
          patchVm(vmId);
        }
        return;
      }
      if (act === "vm-routing-configure") {
        vmSectionKeepOpen(ui, "routing");
        ui.routingEditing = true;
        if (ui.policyDraft == null) ui.policyDraft = String((det && det.routing_policy_yaml) || "");
        patchVm(vmId);
        return;
      }
      if (act === "vm-routing-cancel") {
        vmSectionKeepOpen(ui, "routing");
        if (CE && typeof CE.restoreEditOnCancel === "function") {
          CE.restoreEditOnCancel(ui, {
            editingKey: "routingEditing",
            touchedKey: "policyTouched",
            draftKey: "policyDraft",
            draftValue: String((det && det.routing_policy_yaml) || ""),
            onAfter: function () {
              patchVm(vmId);
            }
          });
        } else {
          ui.routingEditing = false;
          ui.policyTouched = false;
          ui.policyDraft = String((det && det.routing_policy_yaml) || "");
          patchVm(vmId);
        }
        return;
      }
      if (act === "vm-router-configure") {
        vmSectionKeepOpen(ui, "router");
        ui.routerEditing = true;
        patchVm(vmId);
        return;
      }
      if (act === "vm-router-cancel") {
        vmSectionKeepOpen(ui, "router");
        ui.routerEditing = false;
        ui.routerModelsTouched = false;
        ui.routerThresholdTouched = false;
        ui.routerEnabledTouched = false;
        ui.routerModelsDraft = null;
        ui.routerThresholdDraft = null;
        ui.routerEnabledDraft = null;
        patchVm(vmId);
        return;
      }

      if (act === "vm-identity-refresh") {
        fetchVirtualModelDetail(vmId, true).then(function () {
          patchVm(vmId);
        });
        return;
      }
      if (act === "vm-fallback-refresh") {
        fetchVirtualModelDetail(vmId, true).then(function () {
          ui.fallbackTouched = false;
          ui.fallbackDraft = null;
          patchVm(vmId);
        });
        return;
      }
      if (act === "vm-routing-refresh") {
        fetchVirtualModelDetail(vmId, true).then(function () {
          ui.policyTouched = false;
          ui.policyDraft = String((vmDetail(vmId) && vmDetail(vmId).routing_policy_yaml) || "");
          patchVm(vmId);
        });
        return;
      }
      if (act === "vm-router-refresh") {
        fetchVirtualModelDetail(vmId, true).then(function () {
          ui.routerModelsTouched = false;
          ui.routerThresholdTouched = false;
          ui.routerEnabledTouched = false;
          ui.routerModelsDraft = null;
          ui.routerThresholdDraft = null;
          ui.routerEnabledDraft = null;
          patchVm(vmId);
        });
        return;
      }

      if (act === "vm-identity-enabled-toggle" || act === "vm-identity-visibility-toggle") {
        ev.stopPropagation();
        var idToggle = t.closest && t.closest(".sum-router-toggle");
        if (!idToggle) idToggle = t;
        var nextOn = String(idToggle.getAttribute("aria-pressed") || "").toLowerCase() !== "true";
        var idPut = vmIdentityPutBody(vmId, {});
        if (act === "vm-identity-enabled-toggle") idPut.enabled = nextOn;
        else idPut.visibility = nextOn ? "public" : "private";
        (adminPutJSON || adminPostJSON)(vmApiPath(vmId), idPut)
          .then(function () {
            adminSetMessage("", act === "vm-identity-enabled-toggle" ? "Virtual model " + (nextOn ? "enabled." : "disabled.") : "Visibility set to " + idPut.visibility + ".");
            return reloadVm(vmId);
          })
          .catch(function (e) {
            adminSetMessage("err", e && e.message ? e.message : String(e));
          });
        return;
      }

      if (act === "vm-routing-enabled-toggle") {
        ev.stopPropagation();
        var rtRoute = t.closest && t.closest(".sum-router-toggle");
        if (!rtRoute) rtRoute = t;
        var routeOn = String(rtRoute.getAttribute("aria-pressed") || "").toLowerCase() !== "true";
        var yamlNow = String((det && det.routing_policy_yaml) || "");
        if (ui.policyDraft != null) yamlNow = String(ui.policyDraft);
        else {
          var routeTa = document.getElementById(pfx + "routing-yaml-ta");
          if (routeTa && ui.routingEditing) yamlNow = String(routeTa.value || yamlNow);
        }
        if (!yamlNow.trim()) yamlNow = "ambiguous_default_model: \"\"\nrules: []\n";
        (adminPutJSON || adminPostJSON)(vmApiPath(vmId, "/routing-policy"), {
          enabled: routeOn,
          routing_policy_yaml: yamlNow
        })
          .then(function () {
            adminSetMessage("", "Routing policy " + (routeOn ? "enabled." : "disabled."));
            return reloadVm(vmId);
          })
          .catch(function (e) {
            adminSetMessage("err", e && e.message ? e.message : String(e));
          });
        return;
      }

      if (act === "vm-router-enabled-toggle") {
        ev.stopPropagation();
        var rtTool = t.closest && t.closest(".sum-router-toggle");
        if (!rtTool) rtTool = t;
        var toolOn = String(rtTool.getAttribute("aria-pressed") || "").toLowerCase() !== "true";
        var modelsSaved = (det && det.router_models) || [];
        var thrSaved = parseFloat(String((det && det.tool_router_confidence_threshold) || "0.5"));
        if (isNaN(thrSaved) || thrSaved < 0 || thrSaved > 1) thrSaved = 0.5;
        (adminPutJSON || adminPostJSON)(vmApiPath(vmId, "/tool-router"), {
          tool_router_enabled: toolOn,
          router_models: modelsSaved,
          confidence_threshold: thrSaved
        })
          .then(function () {
            adminSetMessage("", "Tool router " + (toolOn ? "enabled." : "disabled."));
            return reloadVm(vmId);
          })
          .catch(function (e) {
            adminSetMessage("err", e && e.message ? e.message : String(e));
          });
        return;
      }

      if (act === "vm-harness-intent-save") {
        var currentIntent = Array.isArray(det && det.harness_modules) ? det.harness_modules.slice() : [];
        var intentCfg = {
          mode: String(((document.getElementById(pfx + "intent-mode") || {}).value || "heuristic")).trim() === "llm" ? "llm" : "heuristic",
          model_id: String(((document.getElementById(pfx + "intent-model-id") || {}).value || "")).trim()
        };
        var intentFound = false;
        for (var intentIndex = 0; intentIndex < currentIntent.length; intentIndex++) {
          if (String(currentIntent[intentIndex].module_id || "") !== "intent") continue;
          currentIntent[intentIndex] = Object.assign({}, currentIntent[intentIndex], { config_json: intentCfg });
          intentFound = true;
          break;
        }
        if (!intentFound) currentIntent.push({ module_id: "intent", enabled: true, config_json: intentCfg });
        (adminPutJSON || adminPostJSON)(vmApiPath(vmId, "/harness"), { modules: currentIntent })
          .then(function () {
            adminSetMessage("", "Intent settings saved.");
            return reloadVm(vmId);
          })
          .catch(function (e) {
            adminSetMessage("err", e && e.message ? e.message : String(e));
          });
        return;
      }

      if (act === "vm-harness-evaluator-save" || act === "vm-harness-escalation-save") {
        var isEvaluator = act === "vm-harness-evaluator-save";
        var configModule = isEvaluator ? "evaluator" : "escalation";
        var currentConfigModules = Array.isArray(det && det.harness_modules) ? det.harness_modules.slice() : [];
        var savedConfig = {};
        for (var configIndex = 0; configIndex < currentConfigModules.length; configIndex++) {
          if (String(currentConfigModules[configIndex].module_id || "") !== configModule) continue;
          savedConfig = currentConfigModules[configIndex].config_json;
          if (typeof savedConfig === "string") {
            try { savedConfig = JSON.parse(savedConfig); } catch (_eConfig) { savedConfig = {}; }
          }
          if (!savedConfig || typeof savedConfig !== "object") savedConfig = {};
          break;
        }
        var nextConfig = isEvaluator
          ? Object.assign({}, savedConfig, {
              mode: String(((document.getElementById(pfx + "evaluator-mode") || {}).value || "single_pass")).trim() === "multi_draft" ? "multi_draft" : "single_pass",
              model_id: String(((document.getElementById(pfx + "evaluator-model-id") || {}).value || "")).trim(),
              draft_count: Math.max(1, Math.min(8, Number(String(((document.getElementById(pfx + "evaluator-draft-count") || {}).value || "3")).trim()) || 3)),
              synthesize_model_id: String(((document.getElementById(pfx + "evaluator-synthesize-model-id") || {}).value || "")).trim(),
              stream_policy: String(((document.getElementById(pfx + "evaluator-stream-policy") || {}).value || "immediate")).trim(),
              min_confidence: Number(String(((document.getElementById(pfx + "evaluator-min-confidence") || {}).value || "")).trim()) || 0,
              hallucination_risk_max: Number(String(((document.getElementById(pfx + "evaluator-hallucination-risk-max") || {}).value || "")).trim()) || 0
            })
          : Object.assign({}, savedConfig, {
              max_rounds: Math.max(0, Math.min(2, Number(String(((document.getElementById(pfx + "escalation-max-rounds") || {}).value || "2")).trim()) || 0)),
              on_fail: String(((document.getElementById(pfx + "escalation-on-fail") || {}).value || "")).split(",").map(function (v) { return v.trim(); }).filter(Boolean),
              human_surfaces: String(((document.getElementById(pfx + "escalation-human-surfaces") || {}).value || "")).split("\n").map(function (line) {
                var parts = line.split("|");
                return { name: String(parts[0] || "").trim(), url: String(parts.slice(1).join("|") || "").trim() };
              }).filter(function (surface) { return surface.name && surface.url; }),
              privacy_disclosure: String(((document.getElementById(pfx + "escalation-privacy-disclosure") || {}).value || "")).trim(),
              paste_back_delimiter: String(((document.getElementById(pfx + "escalation-paste-back-delimiter") || {}).value || "<<<CHIMERA_HUMAN_ANSWER>>>")).trim()
            });
        var configFound = false;
        for (var configUpdate = 0; configUpdate < currentConfigModules.length; configUpdate++) {
          if (String(currentConfigModules[configUpdate].module_id || "") !== configModule) continue;
          currentConfigModules[configUpdate] = Object.assign({}, currentConfigModules[configUpdate], { config_json: nextConfig });
          configFound = true;
          break;
        }
        if (!configFound) currentConfigModules.push({ module_id: configModule, enabled: true, config_json: nextConfig });
        (adminPutJSON || adminPostJSON)(vmApiPath(vmId, "/harness"), { modules: currentConfigModules })
          .then(function () {
            adminSetMessage("", (isEvaluator ? "Evaluator" : "Escalation") + " settings saved.");
            return reloadVm(vmId);
          })
          .catch(function (e) {
            adminSetMessage("err", e && e.message ? e.message : String(e));
          });
        return;
      }

      if (act === "vm-harness-retrieval-save") {
        var currentRetrieval = Array.isArray(det && det.harness_modules) ? det.harness_modules.slice() : [];
        var retrievalCfg = {};
        for (var existingRetrieval = 0; existingRetrieval < currentRetrieval.length; existingRetrieval++) {
          if (String(currentRetrieval[existingRetrieval].module_id || "") !== "retrieval") continue;
          var savedRetrievalCfg = currentRetrieval[existingRetrieval].config_json;
          if (typeof savedRetrievalCfg === "string") {
            try { savedRetrievalCfg = JSON.parse(savedRetrievalCfg); } catch (_eRetrievalCfg) { savedRetrievalCfg = {}; }
          }
          if (savedRetrievalCfg && typeof savedRetrievalCfg === "object") retrievalCfg = Object.assign({}, savedRetrievalCfg);
          break;
        }
        retrievalCfg = Object.assign(retrievalCfg, {
          top_k: Number(String(((document.getElementById(pfx + "retrieval-top-k") || {}).value || "")).trim()) || 0,
          score_floor: Number(String(((document.getElementById(pfx + "retrieval-score-floor") || {}).value || "")).trim()) || 0,
          compress_strategy: String(((document.getElementById(pfx + "retrieval-compress-strategy") || {}).value || "truncate")).trim(),
          max_context_chars: Number(String(((document.getElementById(pfx + "retrieval-max-context-chars") || {}).value || "")).trim()) || 0
        });
        var retrievalFound = false;
        for (var hr = 0; hr < currentRetrieval.length; hr++) {
          if (String(currentRetrieval[hr].module_id || "") === "retrieval") {
            currentRetrieval[hr] = Object.assign({}, currentRetrieval[hr], { config_json: retrievalCfg });
            retrievalFound = true;
            break;
          }
        }
        if (!retrievalFound) currentRetrieval.push({ module_id: "retrieval", enabled: true, config_json: retrievalCfg });
        (adminPutJSON || adminPostJSON)(vmApiPath(vmId, "/harness"), { modules: currentRetrieval })
          .then(function () {
            adminSetMessage("", "Retrieval settings saved.");
            return reloadVm(vmId);
          })
          .catch(function (e) {
            adminSetMessage("err", e && e.message ? e.message : String(e));
          });
        return;
      }

      if (act === "vm-harness-module-toggle") {
        ev.stopPropagation();
        var harnessBtn = t.closest && t.closest(".sum-router-toggle");
        if (!harnessBtn) harnessBtn = t;
        if (harnessBtn.getAttribute("disabled") != null || harnessBtn.getAttribute("aria-disabled") === "true") {
          return;
        }
        var moduleId = String(harnessBtn.getAttribute("data-harness-module") || "").trim();
        if (!moduleId) return;
        var nextOn = String(harnessBtn.getAttribute("aria-pressed") || "").toLowerCase() !== "true";
        var current = Array.isArray(det && det.harness_modules) ? det.harness_modules.slice() : [];
        if (!current.length) {
          current = [
            { module_id: "retrieval", enabled: true, config_json: {} },
            { module_id: "intent", enabled: false, config_json: {} },
            { module_id: "evaluator", enabled: false, config_json: {} },
            { module_id: "escalation", enabled: false, config_json: {} },
            { module_id: "tool_executor", enabled: false, config_json: {} }
          ];
        }
        var found = false;
        for (var hi = 0; hi < current.length; hi++) {
          if (String(current[hi].module_id) === moduleId) {
            current[hi] = Object.assign({}, current[hi], { enabled: nextOn });
            found = true;
            break;
          }
        }
        if (!found) {
          current.push({ module_id: moduleId, enabled: nextOn, config_json: {} });
        }
        (adminPutJSON || adminPostJSON)(vmApiPath(vmId, "/harness"), { modules: current })
          .then(function (resp) {
            if (resp && Array.isArray(resp.modules) && det) {
              det.harness_modules = resp.modules;
            }
            adminSetMessage("", "Harness module " + moduleId + " " + (nextOn ? "enabled." : "disabled."));
            return reloadVm(vmId);
          })
          .catch(function (e) {
            adminSetMessage("err", e && e.message ? e.message : String(e));
          });
        return;
      }

      if (act === "vm-identity-save") {
        var body = vmIdentityPutBody(vmId, {});
        (adminPutJSON || adminPostJSON)(vmApiPath(vmId), body)
          .then(function () {
            ui.identityEditing = false;
            adminSetMessage("", "Virtual model identity saved.");
            return reloadVm(vmId);
          })
          .catch(function (e) {
            adminSetMessage("err", e && e.message ? e.message : String(e));
          });
        return;
      }

      if (act === "vm-fallback-save") {
        try {
          var chain = parseFallbackChainInput(String(((document.getElementById(pfx + "fallback-yaml-ta") || {}).value || "")));
          if (!chain.length) {
            adminSetMessage("err", "Fallback chain must include at least one model id.");
            return;
          }
          runVmJson({
            request: function () {
              return (adminPutJSON || adminPostJSON)(vmApiPath(vmId, "/fallback"), { fallback_chain: chain });
            },
            setMessage: adminSetMessage,
            successMsg: "Fallback chain saved.",
            onSuccess: function () {
              ui.fallbackEditing = false;
              ui.fallbackTouched = false;
              ui.fallbackDraft = null;
              return reloadVm(vmId);
            }
          });
        } catch (e) {
          adminSetMessage("err", e && e.message ? e.message : String(e));
        }
        return;
      }

      if (act === "vm-routing-save") {
        var polYAML = String(((document.getElementById(pfx + "routing-yaml-ta") || {}).value || ""));
        if (!polYAML.trim()) {
          adminSetMessage("err", "Routing policy YAML is required when saving.");
          return;
        }
        var routeToggle = document.getElementById(pfx + "routing-enabled");
        var polOn =
          routeToggle && String(routeToggle.getAttribute("aria-pressed") || "").toLowerCase() === "true";
        runVmJson({
          request: function () {
            return (adminPutJSON || adminPostJSON)(vmApiPath(vmId, "/routing-policy"), {
              enabled: polOn,
              routing_policy_yaml: polYAML
            });
          },
          setMessage: adminSetMessage,
          successMsg: "Routing policy saved.",
          onSuccess: function () {
            ui.routingEditing = false;
            ui.policyTouched = false;
            ui.policyDraft = null;
            return reloadVm(vmId);
          }
        });
        return;
      }

      if (act === "vm-router-save") {
        try {
          var rchain = parseFallbackChainInput(String(((document.getElementById(pfx + "router-yaml-ta") || {}).value || "")));
          var thr = parseFloat(String(((document.getElementById(pfx + "router-threshold") || {}).value || "0.5")));
          if (isNaN(thr) || thr < 0 || thr > 1) thr = 0.5;
          var toolToggle = document.getElementById(pfx + "router-enabled");
          var rOn =
            toolToggle && String(toolToggle.getAttribute("aria-pressed") || "").toLowerCase() === "true";
          runVmJson({
            request: function () {
              return (adminPutJSON || adminPostJSON)(vmApiPath(vmId, "/tool-router"), {
                tool_router_enabled: rOn,
                router_models: rchain,
                confidence_threshold: thr
              });
            },
            setMessage: adminSetMessage,
            successMsg: "Tool router saved.",
            onSuccess: function () {
              ui.routerEditing = false;
              ui.routerModelsTouched = false;
              ui.routerThresholdTouched = false;
              ui.routerEnabledTouched = false;
              ui.routerModelsDraft = null;
              ui.routerThresholdDraft = null;
              ui.routerEnabledDraft = null;
              return reloadVm(vmId);
            }
          });
        } catch (e) {
          adminSetMessage("err", e && e.message ? e.message : String(e));
        }
        return;
      }

      if (act === "vm-fallback-generate" || act === "vm-routing-generate") {
        var genAct = act;
        runVmJson({
          request: function () {
            return adminPostJSON(vmApiPath(vmId, "/routing/generate"), { save: false });
          },
          setMessage: adminSetMessage,
          successMsg:
            genAct === "vm-fallback-generate"
              ? "Generated fallback from live catalog. Keep to save."
              : "Generated routing policy from live catalog. Keep to save.",
          onSuccess: function (j) {
            j = j || {};
            if (genAct === "vm-fallback-generate") {
              ui.fallbackDraft = fallbackChainToYAML(j.fallback_chain || []);
              ui.fallbackTouched = true;
              ui.fallbackEditing = true;
              vmSectionKeepOpen(ui, "fallback");
            } else {
              ui.policyDraft = String(j.routing_policy_yaml || "");
              ui.policyTouched = true;
              ui.routingEditing = true;
              vmSectionKeepOpen(ui, "routing");
            }
            patchVm(vmId);
          }
        });
        return;
      }

    });
  }
};
