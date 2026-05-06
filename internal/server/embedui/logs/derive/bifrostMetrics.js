/**
 * Pure metrics derivation for the bifrost service card.
 *
 * Exports:
 * - ClaudiaLogs.Derive.bifrostEntryHasRateLimit(ent, getFlat)
 * - ClaudiaLogs.Derive.bifrostCardMetrics(arr, getFlat)
 */

function bifrostEntryHasRateLimit(ent, getFlat) {
  getFlat = typeof getFlat === "function" ? getFlat : function (p) { return (p && p.rawFlat) || {}; };
  var f = getFlat(ent && ent.parsed);
  var comb = (String((ent && ent.text) || "") + String(f.msg || "")).toLowerCase();
  return comb.indexOf("429") >= 0 || comb.indexOf("rate limit") >= 0 || comb.indexOf("rate_limit") >= 0;
}

function bifrostCardMetrics(arr, getFlat) {
  arr = Array.isArray(arr) ? arr : [];
  getFlat = typeof getFlat === "function" ? getFlat : function (p) { return (p && p.rawFlat) || {}; };

  var reqN = 0;
  var resN = 0;
  var errN = 0;
  var streamOn = 0;
  var streamOff = 0;
  var outgoingSum = 0;
  var usageSum = 0;
  var bytesSum = 0;
  var sc2xx = 0;
  var scErr = 0;
  var modelCounts = {};
  var rlN = 0;

  for (var i = 0; i < arr.length; i++) {
    var ent = arr[i] || {};
    var p = ent.parsed || {};
    var f = getFlat(p);
    var sh = p.shape || "";
    var msg = String(f.msg != null ? f.msg : f.message != null ? f.message : "").trim();

    if (bifrostEntryHasRateLimit(ent, getFlat)) rlN++;

    if (msg === "chat.bifrost.request") {
      reqN++;
      var ot = Number(f.outgoingTokens);
      if (!isNaN(ot) && ot > 0) outgoingSum += ot;
      if (f.stream === true || f.stream === "true") streamOn++;
      else if (f.stream === false || f.stream === "false") streamOff++;
      var umr = f.upstreamModel != null && String(f.upstreamModel).trim() !== "" ? String(f.upstreamModel).trim() : "";
      if (umr) modelCounts[umr] = (modelCounts[umr] || 0) + 1;
    } else if (msg === "chat.bifrost.error" || msg.indexOf("bifrost.error") >= 0) {
      errN++;
    } else if (msg === "upstream chat response") {
      resN++;
      var ut = Number(f.usageTotalTokens);
      var up = Number(f.usagePromptTokens);
      var uc = Number(f.usageCompletionTokens);
      if (!isNaN(ut) && ut > 0) usageSum += ut;
      else {
        var uPart = (isNaN(up) ? 0 : up) + (isNaN(uc) ? 0 : uc);
        if (uPart > 0) usageSum += uPart;
      }
      var rb = Number(f.responseBytes);
      if (!isNaN(rb) && rb > 0) bytesSum += rb;
    }

    var sc = Number(f.statusCode);
    if (!isNaN(sc) && sc > 0) {
      if (sh === "http.access" || msg === "upstream chat response" || msg === "chat.bifrost.error") {
        if (sc >= 200 && sc < 300) sc2xx++;
        else if (sc >= 400) scErr++;
      }
    }
  }

  var topModel = "";
  var topC = 0;
  for (var mk in modelCounts) {
    if (!Object.prototype.hasOwnProperty.call(modelCounts, mk)) continue;
    var c = modelCounts[mk];
    if (c > topC) {
      topC = c;
      topModel = mk;
    } else if (c === topC && topModel && mk.localeCompare(topModel) < 0) {
      topModel = mk;
    }
  }
  if (!topModel) topModel = "—";

  return {
    reqN: reqN,
    resN: resN,
    errN: errN,
    streamOn: streamOn,
    streamOff: streamOff,
    outgoingSum: outgoingSum,
    usageSum: usageSum,
    bytesSum: bytesSum,
    sc2xx: sc2xx,
    scErr: scErr,
    topModel: topModel,
    rlN: rlN
  };
}

globalThis.ClaudiaLogs = globalThis.ClaudiaLogs || {};
globalThis.ClaudiaLogs.Derive = globalThis.ClaudiaLogs.Derive || {};
globalThis.ClaudiaLogs.Derive.bifrostEntryHasRateLimit = bifrostEntryHasRateLimit;
globalThis.ClaudiaLogs.Derive.bifrostCardMetrics = bifrostCardMetrics;

