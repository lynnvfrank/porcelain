package harness

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/chat"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/conversationhistory"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/gatewaymetrics"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/rag"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/transform"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/vectorstore"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/virtualmodel"
	"github.com/lynn/porcelain/chimera/internal/config"
	"github.com/lynn/porcelain/chimera/internal/providerlimits"
)

// VMStack is the resolved virtual model routing configuration for one chat turn.
type VMStack struct {
	VM           *virtualmodel.Resolved
	Fallback     []string
	ToolEnabled  bool
	RouterModels []string
	ToolThresh   float64
}

// TurnContext carries immutable request dependencies and mutable stage outputs for
// one virtual-model chat turn.
type TurnContext struct {
	W        http.ResponseWriter
	Resolved *config.Resolved
	Stack    VMStack

	Stream           bool
	SkipToolRouter   bool
	HeaderToolThresh float64

	RouteLog       *slog.Logger
	ConversationID string
	TurnIndex      int
	RequestID      string
	TenantID       string
	ProjectID      string
	FlavorID       string
	APIKey         string
	Timeout        time.Duration

	ChatOpts *chat.ProxyOpts
	HistRec  *conversationhistory.Recorder

	RAG                 *rag.Service
	Metrics             gatewaymetrics.Recorder
	LimitsGuard         *providerlimits.Guard
	ModelAvailable      func(id string) bool
	OnToolRouterAttempt func(model string, err error)
	EmitRequestWitness  func(log *slog.Logger, res *config.Resolved, body map[string]json.RawMessage)

	// Mutable outputs populated by stages.
	RAGHits      []vectorstore.Hit
	InitialModel string
	ToolRouter   transform.ToolRouterSummary
	Envelope     *TurnEnvelope
}

// VirtualModelID returns the client-facing virtual model id when stack is loaded.
func (tc *TurnContext) VirtualModelID() string {
	if tc == nil || tc.Stack.VM == nil {
		return ""
	}
	return tc.Stack.VM.ModelID
}
