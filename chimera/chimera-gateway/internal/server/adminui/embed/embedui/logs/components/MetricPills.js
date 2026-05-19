/** Re-export ChimeraUI.MetricPillsRow for legacy script path. */
globalThis.ChimeraLogs = globalThis.ChimeraLogs || {};
if (globalThis.ChimeraUI && globalThis.ChimeraUI.MetricPillsRow) {
  globalThis.ChimeraLogs.MetricPillsRow = globalThis.ChimeraUI.MetricPillsRow;
}
