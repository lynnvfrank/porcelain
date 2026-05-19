/**
 * Service card helpers (full buildServiceCard remains in summarizedFeed.js).
 */
globalThis.ChimeraLogs = globalThis.ChimeraLogs || {};
globalThis.ChimeraLogs.Render = globalThis.ChimeraLogs.Render || {};
globalThis.ChimeraLogs.Render.Cards = globalThis.ChimeraLogs.Render.Cards || {};

globalThis.ChimeraLogs.Render.Cards.mountServiceCard = function (ctx) {
  var avatarInitials = ctx.avatarInitials;
  var avatarHueClass = ctx.avatarHueClass;

  function serviceAvatarClass(name) {
    switch (name) {
      case "chimera-gateway":
        return "sum-av-svc-chimera-gateway";
      case "chimera-broker":
        return "sum-av-svc-chimera-broker";
      case "chimera-vectorstore":
        return "sum-av-svc-chimera-vectorstore";
      case "chimera-indexer":
        return "sum-av-svc-chimera-indexer";
      default:
        return avatarHueClass(name);
    }
  }

  function serviceAvatarInitials(name) {
    switch (name) {
      case "chimera-broker":
        return "CB";
      case "chimera-gateway":
        return "CW";
      case "chimera-vectorstore":
        return "CV";
      case "chimera-indexer":
        return "CI";
      default:
        return avatarInitials(name);
    }
  }

  ctx.serviceAvatarClass = serviceAvatarClass;
  ctx.serviceAvatarInitials = serviceAvatarInitials;
};
