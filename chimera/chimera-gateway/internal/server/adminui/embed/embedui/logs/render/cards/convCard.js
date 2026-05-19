/**
 * Conversation card helpers (full buildConvCard remains in summarizedFeed.js).
 */
globalThis.ChimeraLogs = globalThis.ChimeraLogs || {};
globalThis.ChimeraLogs.Render = globalThis.ChimeraLogs.Render || {};
globalThis.ChimeraLogs.Render.Cards = globalThis.ChimeraLogs.Render.Cards || {};

globalThis.ChimeraLogs.Render.Cards.mountConvCard = function (ctx) {
  function formatMergedConversationSubtitle(mergedCount) {
    if (!mergedCount || mergedCount <= 1) return "";
    return (
      ' <span class="muted" style="font-size:0.85em" title="Multiple conversation ids in one card (unusual).">(' +
      mergedCount +
      " ids)</span>"
    );
  }

  ctx.formatMergedConversationSubtitle = formatMergedConversationSubtitle;
};
