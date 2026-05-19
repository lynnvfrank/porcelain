/** Re-export ChimeraUI.KeyValueGrid for legacy script path. */
globalThis.ChimeraLogs = globalThis.ChimeraLogs || {};
if (globalThis.ChimeraUI && globalThis.ChimeraUI.KeyValueGrid) {
  globalThis.ChimeraLogs.KeyValueGrid = globalThis.ChimeraUI.KeyValueGrid;
}
