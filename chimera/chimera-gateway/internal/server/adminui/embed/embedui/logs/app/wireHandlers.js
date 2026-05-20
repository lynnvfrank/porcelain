/**
 * DOM event wiring for summarized cards, workspaces, admin workflows, and chrome links.
 *
 * Exports: ChimeraLogs.App.mountWireHandlers(ctx)
 */

globalThis.ChimeraLogs = globalThis.ChimeraLogs || {};
globalThis.ChimeraLogs.App = globalThis.ChimeraLogs.App || {};
globalThis.ChimeraLogs.App.mountWireHandlers = function (ctx) {
  var H = globalThis.ChimeraLogs && globalThis.ChimeraLogs.Handlers;
  if (!H) return;
  if (typeof H.Evlog.wire === "function") H.Evlog.wire(ctx);
  if (typeof H.Chrome.wire === "function") H.Chrome.wire(ctx);
  if (typeof H.Admin.wire === "function") H.Admin.wire(ctx);
};
