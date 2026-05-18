package server

import (
	"context"
	"log/slog"
	"time"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/catalog"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/ingest"
	gruntime "github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/runtime"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/scope"
	"github.com/lynn/porcelain/chimera/internal/config"
)

// Runtime is the gateway process state (config, tokens, RAG, metrics, catalog cache).
type Runtime = gruntime.Runtime

// IndexerSupervisorStatus is the gateway-owned view of supervised indexer health.
type IndexerSupervisorStatus = gruntime.IndexerSupervisorStatus

// CatalogSnapshot is a point-in-time chimera-broker /v1/models view.
type CatalogSnapshot = catalog.CatalogSnapshot

// CatalogSnapshotFreshness is the default staleness window for catalog-driven health checks.
const CatalogSnapshotFreshness = catalog.CatalogSnapshotFreshness

// Ingest / indexer header names (re-exported for tests and callers).
const (
	HeaderProject  = ingest.HeaderProject
	HeaderFlavor   = ingest.HeaderFlavor
	HeaderIndexRun = ingest.HeaderIndexRun
)

// OptionalConversationIDFromHeader returns a validated conversation id header when present.
var OptionalConversationIDFromHeader = scope.OptionalConversationIDFromHeader

// DefaultUICookieName is the operator UI session cookie name.
const DefaultUICookieName = adminui.DefaultUICookieName

// NewRuntime loads gateway config and constructs process state.
var NewRuntime = gruntime.NewRuntime

// NewRuntimeWithUpstreamOverride is like NewRuntime but can patch upstream base URL.
var NewRuntimeWithUpstreamOverride = gruntime.NewRuntimeWithUpstreamOverride

// RefreshAvailableModels polls upstream models and caches the snapshot on the runtime.
var RefreshAvailableModels = gruntime.RefreshAvailableModels

// LogUpstreamAvailableModelsForLogsUI logs the merged upstream catalog once.
var LogUpstreamAvailableModelsForLogsUI = gruntime.LogUpstreamAvailableModelsForLogsUI

// StartCatalogPoller periodically refreshes the catalog snapshot.
var StartCatalogPoller = gruntime.StartCatalogPoller

// RegisterCatalogAuditor appends a post-refresh catalog auditor.
var RegisterCatalogAuditor = catalog.RegisterCatalogAuditor

// BuildCatalogSnapshot builds a catalog snapshot without mutating runtime (tests).
func BuildCatalogSnapshot(ctx context.Context, res *config.Resolved, apiKey string, timeout time.Duration, log *slog.Logger) *CatalogSnapshot {
	return catalog.BuildSnapshot(ctx, res, apiKey, timeout, log)
}

// UIOptions configures operator UI routes.
type UIOptions = adminui.UIOptions

// NewUIOptions returns default UI session options.
var NewUIOptions = adminui.NewUIOptions
