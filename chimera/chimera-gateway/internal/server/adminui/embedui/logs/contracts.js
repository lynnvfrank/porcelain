/**
 * Operator logs UI constants — mirror internal/naming/gateway_logs.go and contracts.go.
 * Hand-maintained; keep in sync with Go naming tests (sources_naming_test.go).
 */
(function () {
  globalThis.ChimeraLogs = globalThis.ChimeraLogs || {};
  globalThis.ChimeraLogs.Contracts = {
    ProductGateway: "chimera-gateway",
    ProductBroker: "chimera-broker",
    ProductVectorstore: "chimera-vectorstore",
    ProductIndexer: "chimera-indexer",
    ProductSupervisor: "chimera-supervisor",

    LogSourceChimeraGateway: "chimera-gateway",
    LogSourceChimeraBroker: "chimera-broker",
    LogSourceChimeraVectorstore: "chimera-vectorstore",
    LogSourceChimeraIndexer: "chimera-indexer",
    LogSourceChimeraSupervisor: "chimera-supervisor",

    TimelineKindWeb: "web",
    TimelineKindBroker: "broker",
    TimelineKindVectorstore: "vectorstore",
    TimelineKindIndexer: "indexer",
    TimelineKindGateway: "gateway",

    LogsUIPrefViewMode: "chimera_logs_view_mode",
    LogsUIPrefFilterApp: "chimera_logs_flt_app",
    LogsUIPrefFilterLevel: "chimera_logs_flt_level",
    LogsUIPrefIndexerWatchRoots: "chimera.indexer.watchRoots.v2",
    LogsUIPrefGatewayShowProbes: "chimera.logs.gateway.showProbes",

    /** Request-timeline bar keys (product display names). */
    TimelineBarKinds: [
      { key: "chimera-gateway", label: "chimera-gateway" },
      { key: "chimera-broker", label: "chimera-broker" },
      { key: "chimera-vectorstore", label: "chimera-vectorstore" },
      { key: "chimera-indexer", label: "chimera-indexer" },
      { key: "web", label: "web" }
    ],

    serviceBadgeClass: function (productKey) {
      var k = String(productKey || "").toLowerCase();
      if (k === "chimera-broker" || k === "broker") return "sum-svc-broker";
      if (k === "chimera-vectorstore" || k === "vectorstore") return "sum-svc-vectorstore";
      if (k === "chimera-indexer" || k === "indexer") return "sum-svc-indexer";
      if (k === "chimera-gateway" || k === "gateway") return "sum-svc-gateway";
      if (k === "web") return "sum-svc-web";
      return "sum-svc-gateway";
    }
  };
})();
