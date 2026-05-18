// Package scope holds shared request header names and resolution for ingest, indexer, and chat.
package scope

import (
	"net/http"
	"strings"

	"github.com/lynn/porcelain/chimera/internal/platform/requestid"
	"github.com/lynn/porcelain/internal/naming"
)

// Header names for ingest and indexer APIs.
const (
	HeaderProject  = naming.HeaderProjectTarget
	HeaderFlavor   = naming.HeaderFlavorTarget
	HeaderIndexRun = naming.HeaderIndexRunTarget
)

// OptionalConversationIDFromHeader returns a validated X-Chimera-Conversation-Id when present.
func OptionalConversationIDFromHeader(r *http.Request) string {
	if h := strings.TrimSpace(r.Header.Get(naming.HeaderConversationIDTarget)); requestid.Valid(h) {
		return h
	}
	return ""
}

// ResolveProject picks the header value, config default, or "default".
func ResolveProject(headerVal, def string) string {
	if v := strings.TrimSpace(headerVal); v != "" {
		return v
	}
	if d := strings.TrimSpace(def); d != "" {
		return d
	}
	return "default"
}

// ResolveFlavor picks the header value or config default.
func ResolveFlavor(headerVal, def string) string {
	if v := strings.TrimSpace(headerVal); v != "" {
		return v
	}
	return strings.TrimSpace(def)
}
