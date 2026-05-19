/** Re-export ChimeraUI.Badge for legacy script path. */
globalThis.ChimeraLogs = globalThis.ChimeraLogs || {};
if (globalThis.ChimeraUI && globalThis.ChimeraUI.Badge) {
  globalThis.ChimeraLogs.Badge = globalThis.ChimeraUI.Badge;
}
