/**
 * Summarized feed card render (Phase 3 extraction).
 * Registers builders on ctx during ChimeraLogs.Render.Cards.mount*.
 */
globalThis.ChimeraLogs = globalThis.ChimeraLogs || {};
globalThis.ChimeraLogs.Render = globalThis.ChimeraLogs.Render || {};
globalThis.ChimeraLogs.Render.Cards = globalThis.ChimeraLogs.Render.Cards || {};

globalThis.ChimeraLogs.Render.Cards.mountAdminWorkflows = function (ctx) {
  var buildAdminUsersCardHtml = ctx.buildAdminUsersCardHtml;
  var buildAdminProviderCardHtml = ctx.buildAdminProviderCardHtml;
  var buildAdminRoutingRulesCardHtml = ctx.buildAdminRoutingRulesCardHtml;
  var buildAdminFallbackCardHtml = ctx.buildAdminFallbackCardHtml;
  var buildAdminRouterModelCardHtml = ctx.buildAdminRouterModelCardHtml;

  function buildAdminWorkflowsFeedSection() {
    return (
      '<div class="sum-feed-section">' +
      buildAdminUsersCardHtml() +
      '<div class="sum-section-label sum-feed-section-title">Providers</div>' +
      '<div class="sum-workspaces-intro"><p class="sum-workspaces-intro-lead">Providers drive upstream inference through chimera-broker; each card shows configuration, usage, and scoped log activity.</p></div>' +
      buildAdminProviderCardHtml("groq", "Groq", "Gq", "LPU inference provider with key management.") +
      buildAdminProviderCardHtml("gemini", "Gemini", "Gm", "Google Gemini provider with key management.") +
      buildAdminProviderCardHtml("ollama", "Ollama", "Ol", "Local/remote Ollama endpoint for chat and embeddings.") +
      '<div class="sum-section-label sum-feed-section-title">Routing</div>' +
      '<div class="sum-workspaces-intro"><p class="sum-workspaces-intro-lead">Routing controls are fully editable here: policy YAML, fallback chain, and tool-router settings.</p></div>' +
      buildAdminRoutingRulesCardHtml() +
      buildAdminFallbackCardHtml() +
      buildAdminRouterModelCardHtml() +
      "</div>"
    );
  }

  ctx.buildAdminWorkflowsFeedSection = buildAdminWorkflowsFeedSection;
};
