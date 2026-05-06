/**
 * Pure derivations for Qdrant card and Gateway RAG traces.
 *
 * Exports:
 * - ClaudiaLogs.Derive.rollupGatewayRagPipeline(entries, getFlat)
 * - ClaudiaLogs.Derive.qdrantHttpPathRollup(arr, getFlat)
 */

function rollupGatewayRagPipeline(entries, getFlat) {
  entries = Array.isArray(entries) ? entries : [];
  getFlat = typeof getFlat === "function" ? getFlat : function (p) { return (p && p.rawFlat) || {}; };

  var ragQuery = 0, ragEmbed = 0, ragHitLines = 0, embedMsSum = 0;
  for (var i = 0; i < entries.length; i++) {
    var f = getFlat(entries[i].parsed);
    var msg = String(f.msg != null ? f.msg : f.message != null ? f.message : "").toLowerCase();
    if (msg === "rag.query") ragQuery++;
    if (msg === "rag.embed") {
      ragEmbed++;
      var em = Number(f.elapsed_ms != null ? f.elapsed_ms : f.elapsedMs);
      if (!isNaN(em)) embedMsSum += em;
    }
    if (msg === "rag.hit") ragHitLines++;
  }
  return { ragQuery: ragQuery, ragEmbed: ragEmbed, ragHitLines: ragHitLines, embedMsSum: embedMsSum };
}

function qdrantHttpPathRollup(arr, getFlat) {
  arr = Array.isArray(arr) ? arr : [];
  getFlat = typeof getFlat === "function" ? getFlat : function (p) { return (p && p.rawFlat) || {}; };

  var searchN = 0, upsertN = 0, scrollN = 0;
  for (var i = 0; i < arr.length; i++) {
    var p = (arr[i] && arr[i].parsed) || {};
    if (p.shape !== "http.access") continue;
    var f = getFlat(p);
    var path = String(f.path || "").toLowerCase();
    var method = String(f.method || "").toUpperCase();
    if (path.indexOf("/points/search") >= 0) { searchN++; continue; }
    if (path.indexOf("/points/scroll") >= 0) { scrollN++; continue; }
    if (
      method === "PUT" &&
      path.indexOf("/collections/") >= 0 &&
      path.indexOf("/points") >= 0 &&
      path.indexOf("/points/search") < 0 &&
      path.indexOf("/points/scroll") < 0
    ) {
      upsertN++;
    }
  }
  return { searchN: searchN, upsertN: upsertN, scrollN: scrollN };
}

globalThis.ClaudiaLogs = globalThis.ClaudiaLogs || {};
globalThis.ClaudiaLogs.Derive = globalThis.ClaudiaLogs.Derive || {};
globalThis.ClaudiaLogs.Derive.rollupGatewayRagPipeline = rollupGatewayRagPipeline;
globalThis.ClaudiaLogs.Derive.qdrantHttpPathRollup = qdrantHttpPathRollup;

