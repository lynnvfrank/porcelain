package server

import (
	"strings"

	"github.com/lynn/porcelain/internal/naming"
)

// timelineKindForGatewayHTTPPath classifies inbound gateway HTTP access lines for the logs UI
// request-timeline bar (adminui/embedui/logs.js TIMELINE_BAR_KINDS). Values: naming.TimelineKind*.
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
	// Future gateway-exposed vectorstore proxy or passthrough; also matches raw collection REST paths.
	if strings.HasPrefix(path, "/v1/qdrant") || strings.Contains(path, "/collections/") {
		return naming.TimelineKindVectorstore
	}
	return naming.TimelineKindWeb
}
