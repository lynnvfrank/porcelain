/** Re-export ChimeraUI.Badge for legacy script path. */
globalThis.ChimeraSettings = globalThis.ChimeraSettings || {};
if (globalThis.ChimeraUI && globalThis.ChimeraUI.Badge) {
  globalThis.ChimeraSettings.Badge = globalThis.ChimeraUI.Badge;
}
