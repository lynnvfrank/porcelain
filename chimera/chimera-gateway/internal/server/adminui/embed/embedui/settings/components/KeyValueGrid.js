/** Re-export ChimeraUI.KeyValueGrid for legacy script path. */
globalThis.ChimeraSettings = globalThis.ChimeraSettings || {};
if (globalThis.ChimeraUI && globalThis.ChimeraUI.KeyValueGrid) {
  globalThis.ChimeraSettings.KeyValueGrid = globalThis.ChimeraUI.KeyValueGrid;
}
