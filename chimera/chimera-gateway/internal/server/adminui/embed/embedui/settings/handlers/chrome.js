/**
 * Logs chrome and in-card navigation links (external URLs, project paths).
 * Exports: ChimeraSettings.Handlers.Chrome.wire(ctx)
 */
globalThis.ChimeraSettings = globalThis.ChimeraSettings || {};
globalThis.ChimeraSettings.Handlers = globalThis.ChimeraSettings.Handlers || {};
globalThis.ChimeraSettings.Handlers.Chrome = globalThis.ChimeraSettings.Handlers.Chrome || {};

globalThis.ChimeraSettings.Handlers.Chrome.wire = function (ctx) {
  if (globalThis.__ChimeraSettingsChromeWired) return;
  globalThis.__ChimeraSettingsChromeWired = true;
    document.body.addEventListener(
      "click",
      function (ev) {
        var t = ev.target;
        if (!t || typeof t.closest !== "function") return;
        var ext = t.closest("a.sum-ext-link");
        if (ext) {
          var href = ext.getAttribute("href") || "";
          if (/^https?:\/\//i.test(href)) {
            ev.preventDefault();
            ev.stopPropagation();
            if (typeof globalThis.chimeraOpenExternalURL === "function") {
              try {
                var ret = globalThis.chimeraOpenExternalURL(href);
                if (ret && typeof ret.then === "function") ret.catch(function () { });
              } catch (x) { }
            } else {
              try {
                window.open(href, "_blank", "noopener,noreferrer");
              } catch (x2) { }
            }
          }
          return;
        }
        var proj = t.closest("a.sum-proj-path");
        if (proj) {
          ev.preventDefault();
          ev.stopPropagation();
          var rel = proj.getAttribute("data-rel") || "";
          if (!rel) rel = proj.textContent || "";
          rel = String(rel).replace(/\s+/g, " ").trim();
          if (!rel) return;
          if (typeof globalThis.chimeraRevealProjectPath === "function") {
            try {
              var ret2 = globalThis.chimeraRevealProjectPath(rel);
              if (ret2 && typeof ret2.then === "function") ret2.catch(function () { });
            } catch (x3) { }
          }
          return;
        }
      },
      true
    );
};
