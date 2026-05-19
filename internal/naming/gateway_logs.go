package naming

// Gateway operator logs: timeline_kind values, structured-log msg prefixes, and logs UI prefs.
//
// Per-message slugs: see log_messages.go (generated from internal/operatorcopy/messages.yaml).
//
// Service source IDs (JSON "service" on normalized ring-buffer lines) match
// chimera/internal/servicelogs/sources.go — import servicelogs when wiring buffers;
// use LogSource* here for gateway UI, tests, and codegen that should not depend on chimera/.
//
// JS mirror: adminui/embed/embedui/logs/contracts.js (go generate ./internal/naming — see logs_ui.go).
const (
	LogSourceChimeraGateway     = "chimera-gateway"
	LogSourceChimeraBroker      = "chimera-broker"
	LogSourceChimeraVectorstore = "chimera-vectorstore"
	LogSourceChimeraIndexer     = "chimera-indexer"
	LogSourceChimeraSupervisor  = "chimera-supervisor"
)

// TimelineKind* are JSON timeline_kind values on gateway-emitted structured logs
// (HTTP access classification, chat/RAG correlation). Short slugs — not product display names.
const (
	TimelineKindWeb         = "web"
	TimelineKindBroker      = "broker"
	TimelineKindVectorstore = "vectorstore"
	TimelineKindIndexer     = "indexer"
	TimelineKindGateway     = "gateway"
)

// LogMsgPrefix* are dotted-msg family prefixes for prefix tests and future codegen.
const (
	LogMsgPrefixBroker      = "broker."
	LogMsgPrefixVectorstore = "vectorstore."
	LogMsgPrefixGateway     = "gateway."
	LogMsgPrefixIngest      = "ingest."
	LogMsgPrefixIndexer     = "indexer."
)

// Logs UI localStorage keys (operator prefs — do not rename without a migration note).
const (
	LogsUIPrefViewMode          = "chimera_logs_view_mode"
	LogsUIPrefFilterApp         = "chimera_logs_flt_app"
	LogsUIPrefFilterLevel       = "chimera_logs_flt_level"
	LogsUIPrefIndexerWatchRoots = "chimera.indexer.watchRoots.v2"
	LogsUIPrefGatewayShowProbes = "chimera.logs.gateway.showProbes"
)
