#!/usr/bin/env python3
"""Extract card render functions from summarizedFeed.js into logs/render/cards/*.js"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FEED = ROOT / "logs" / "app" / "summarizedFeed.js"
CARDS = ROOT / "logs" / "render" / "cards"
CARDS.mkdir(parents=True, exist_ok=True)

lines = FEED.read_text(encoding="utf-8").splitlines(keepends=True)

# 1-based inclusive line ranges to extract (will be removed from feed)
EXTRACT_RANGES = [
    (296, 441),   # formatInt .. metricsEventsTableHtml
    (577, 600),   # buildGatewayUsageIntroHtml
    (900, 1034),  # gateway health + overview card + feed section
    (1036, 1079), # fallback yaml utils
    (1150, 1556), # admin helpers through adminScopedEvlogPanel
    (1608, 1662), # admin user cards
    (1664, 1737), # admin provider
    (1739, 1811), # admin routing
    (1813, 1869), # admin fallback
    (1871, 1962), # admin router model
    (1944, 1962), # adminScopedEventsForRouting (overlap check)
    (1964, 1980), # buildAdminWorkflowsFeedSection
    (1982, 2063), # buildGatewayUsageCardHtml
    (694, 796),   # buildWorkspaceDraftCardHtml
]

# Merge overlapping ranges and sort
merged = []
for a, b in sorted(EXTRACT_RANGES):
    if merged and a <= merged[-1][1] + 1:
        merged[-1] = (merged[-1][0], max(merged[-1][1], b))
    else:
        merged.append([a, b])

FILES = {
    "sharedFormat.js": [(296, 441)],
    "gatewayOverview.js": [(900, 1034)],
    "gatewayUsage.js": [(577, 600), (1982, 2063)],
    "adminShared.js": [(1036, 1079), (1150, 1556)],
    "adminUsers.js": [(1608, 1662)],
    "adminProvider.js": [(1664, 1737)],
    "adminRouting.js": [(1739, 1811)],
    "adminFallback.js": [(1813, 1869)],
    "adminRouterModels.js": [(1871, 1962)],
    "adminWorkflows.js": [(1964, 1980)],
    "workspaceDraft.js": [(694, 796)],
}

HEADER = """/**
 * Summarized feed card render (Phase 3 extraction).
 * Registers builders on ctx during ChimeraLogs.Render.Cards.mount*.
 */
globalThis.ChimeraLogs = globalThis.ChimeraLogs || {};
globalThis.ChimeraLogs.Render = globalThis.ChimeraLogs.Render || {};
globalThis.ChimeraLogs.Render.Cards = globalThis.ChimeraLogs.Render.Cards || {};

"""

MOUNT_NAMES = {
    "sharedFormat.js": "mountSharedFormat",
    "gatewayOverview.js": "mountGatewayOverview",
    "gatewayUsage.js": "mountGatewayUsage",
    "adminShared.js": "mountAdminShared",
    "adminUsers.js": "mountAdminUsers",
    "adminProvider.js": "mountAdminProvider",
    "adminRouting.js": "mountAdminRouting",
    "adminFallback.js": "mountAdminFallback",
    "adminRouterModels.js": "mountAdminRouterModels",
    "adminWorkflows.js": "mountAdminWorkflows",
    "workspaceDraft.js": "mountWorkspaceDraft",
}

CTX_BINDINGS = {
    "sharedFormat.js": [
        "formatInt", "aggregateRollupRows", "formatCompactTok", "pad2Utc",
        "formatUtcLikeLogTimestamp", "formatUtcToMinute", "formatUtcToDay",
        "metricsRollupTableHtml", "metricsEventsTableHtml",
    ],
    "gatewayOverview.js": [
        "overviewStatePillClass", "gatewayServiceHealthTone", "gatewayServiceHealthEntries",
        "gatewayServiceHealthStripHtml", "buildGatewayOverviewCardHtml", "buildGatewayOverviewFeedSection",
    ],
    "gatewayUsage.js": ["buildGatewayUsageIntroHtml", "buildGatewayUsageCardHtml"],
    "adminShared.js": [
        "fallbackChainToYAML", "parseFallbackChainInput", "providerRowsHtml", "adminProviderIntro",
        "adminProviderAvatarClass", "adminProviderHealthEntry", "adminProviderAvailabilityHtml",
        "adminProviderModelCount", "countRoutingRulesFromYAML", "parseRoutingYamlScalar",
        "parseRoutingRulesFromYAML", "adminPrincipalForFlat", "adminExtractProviderModel",
        "adminProviderCatalogModels", "adminProviderUsageRows", "adminModelUsageById",
        "adminProviderTierSpan", "adminScopedEventsForPrincipal", "adminUserStatsByPrincipal",
        "adminScopedEventsForRouting", "adminScopedEvlogPanelFromEvents",
    ],
    "adminUsers.js": ["buildAdminUserDraftCardHtml", "buildAdminUsersCardHtml"],
    "adminProvider.js": ["buildAdminProviderCardHtml"],
    "adminRouting.js": ["buildAdminRoutingRulesCardHtml"],
    "adminFallback.js": ["buildAdminFallbackCardHtml"],
    "adminRouterModels.js": ["buildAdminRouterModelCardHtml"],
    "adminWorkflows.js": ["buildAdminWorkflowsFeedSection"],
    "workspaceDraft.js": ["buildWorkspaceDraftCardHtml"],
}


def slice_lines(ranges):
    chunks = []
    for a, b in ranges:
        chunks.append("".join(lines[a - 1 : b]))
    return chunks


def build_mount_file(fname, ranges):
    mount = MOUNT_NAMES[fname]
    body = slice_lines(ranges)
    out = HEADER + f"globalThis.ChimeraLogs.Render.Cards.{mount} = function (ctx) {{\n"
    for chunk in body:
        # functions already have 2-space indent from feed
        out += chunk
        if not chunk.endswith("\n"):
            out += "\n"
    out += "\n"
    for fn in CTX_BINDINGS.get(fname, []):
        out += f"  ctx.{fn} = {fn};\n"
    out += "};\n"
    return out


for fname, ranges in FILES.items():
    path = CARDS / fname
    path.write_text(build_mount_file(fname, ranges), encoding="utf-8")
    print("wrote", path.name)

# Remove extracted lines from feed (bottom-up)
remove = sorted(merged, key=lambda x: -x[0])
new_lines = lines[:]
for a, b in remove:
    del new_lines[a - 1 : b]

# Insert mount block before ctx exports at end of mountSummarizedFeed
insert_at = None
for i, ln in enumerate(new_lines):
    if "ctx.refreshSummarizedPanel = refreshSummarizedPanel" in ln:
        insert_at = i
        break

mount_block = """
  if (globalThis.ChimeraLogs.Render && globalThis.ChimeraLogs.Render.Cards) {
    var Cards = globalThis.ChimeraLogs.Render.Cards;
    if (typeof Cards.mountSharedFormat === "function") Cards.mountSharedFormat(ctx);
    if (typeof Cards.mountGatewayOverview === "function") Cards.mountGatewayOverview(ctx);
    if (typeof Cards.mountGatewayUsage === "function") Cards.mountGatewayUsage(ctx);
    if (typeof Cards.mountAdminShared === "function") Cards.mountAdminShared(ctx);
    if (typeof Cards.mountAdminUsers === "function") Cards.mountAdminUsers(ctx);
    if (typeof Cards.mountAdminProvider === "function") Cards.mountAdminProvider(ctx);
    if (typeof Cards.mountAdminRouting === "function") Cards.mountAdminRouting(ctx);
    if (typeof Cards.mountAdminFallback === "function") Cards.mountAdminFallback(ctx);
    if (typeof Cards.mountAdminRouterModels === "function") Cards.mountAdminRouterModels(ctx);
    if (typeof Cards.mountAdminWorkflows === "function") Cards.mountAdminWorkflows(ctx);
    if (typeof Cards.mountWorkspaceDraft === "function") Cards.mountWorkspaceDraft(ctx);
  }
  var formatInt = ctx.formatInt;
  var aggregateRollupRows = ctx.aggregateRollupRows;
  var formatCompactTok = ctx.formatCompactTok;
  var formatUtcLikeLogTimestamp = ctx.formatUtcLikeLogTimestamp;
  var formatUtcToMinute = ctx.formatUtcToMinute;
  var formatUtcToDay = ctx.formatUtcToDay;
  var metricsRollupTableHtml = ctx.metricsRollupTableHtml;
  var metricsEventsTableHtml = ctx.metricsEventsTableHtml;
  var buildGatewayOverviewCardHtml = ctx.buildGatewayOverviewCardHtml;
  var buildGatewayUsageCardHtml = ctx.buildGatewayUsageCardHtml;
  var buildGatewayOverviewFeedSection = ctx.buildGatewayOverviewFeedSection;
  var buildAdminWorkflowsFeedSection = ctx.buildAdminWorkflowsFeedSection;
  var buildWorkspaceDraftCardHtml = ctx.buildWorkspaceDraftCardHtml;
  var fallbackChainToYAML = ctx.fallbackChainToYAML;
  var parseFallbackChainInput = ctx.parseFallbackChainInput;
"""

if insert_at:
    new_lines[insert_at:insert_at] = [mount_block]

FEED.write_text("".join(new_lines), encoding="utf-8")
print("updated summarizedFeed.js, lines:", len(new_lines))
