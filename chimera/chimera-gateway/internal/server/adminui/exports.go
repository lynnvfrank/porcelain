package adminui

import (
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui/api/providers"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui/embed"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui/session"
	"github.com/lynn/porcelain/internal/operatorapi"
)

// DefaultUICookieName is the operator UI session cookie name.
const DefaultUICookieName = session.DefaultUICookieName

// UIOptions configures operator UI routes.
type UIOptions = session.UIOptions

// NewUIOptions returns default UI session options.
var NewUIOptions = session.NewUIOptions

// ReadEmbedFile returns bytes for an embedded operator UI asset.
var ReadEmbedFile = embed.ReadFile

// Operator API DTOs and helpers (tests, cross-package callers).
type (
	ProviderHealthEntry    = operatorapi.ProviderHealthEntry
	ProviderHealthResponse = operatorapi.ProviderHealthResponse
)

var (
	ClassifyBrokerProviderResult = providers.ClassifyBrokerProviderResult
	FetchBrokerProviderHealth    = providers.FetchBrokerProviderHealth
)
