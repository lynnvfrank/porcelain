/** Re-export ChimeraUI.MetricPillsRow for legacy script path. */
globalThis.ChimeraSettings = globalThis.ChimeraSettings || {};
if (globalThis.ChimeraUI && globalThis.ChimeraUI.MetricPillsRow) {
  globalThis.ChimeraSettings.MetricPillsRow = globalThis.ChimeraUI.MetricPillsRow;
}
