package server

import (
	"strings"

	"github.com/lynn/porcelain/internal/naming"
)

// timelineKindForGatewayHTTPPath classifies inbound gateway HTTP access lines for the logs UI
// request-timeline bar (adminui/embedui/logs/contracts.js TimelineBarKinds). Values: naming.TimelineKind*.
func timelineKindForGatewayHTTPPath(path string) string {
	if path == "" {
		return naming.TimelineKindWeb
	}
	if strings.HasPrefix(path, "/v1/ingest") || strings.HasPrefix(path, "/v1/indexer") {
		return naming.TimelineKindIndexer
	}
	if path == "/v1/chat/completions" || path == "/v1/models" || path == "/ui/models" {
		return naming.TimelineKindBroker
	}
	// Raw collection REST paths (vectorstore backend); gateway does not expose /v1/qdrant-shaped URLs.
	if strings.Contains(path, "/collections/") {
		return naming.TimelineKindVectorstore
	}
	return naming.TimelineKindWeb
}
