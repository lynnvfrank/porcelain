package ingest

import "github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/scope"

// Re-export scope headers for ingest callers.
const (
	HeaderProject  = scope.HeaderProject
	HeaderFlavor   = scope.HeaderFlavor
	HeaderIndexRun = scope.HeaderIndexRun
)

var (
	OptionalConversationIDFromHeader = scope.OptionalConversationIDFromHeader
	ResolveProject                   = scope.ResolveProject
	ResolveFlavor                    = scope.ResolveFlavor
)
