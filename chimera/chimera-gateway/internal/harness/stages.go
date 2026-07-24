package harness

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/chat"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/rag"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/transform"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/vectorstore"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/virtualmodel"
	"github.com/lynn/porcelain/internal/naming"
)

// StackResolveStage validates the resolved virtual model stack is present.
type StackResolveStage struct{}

func (StackResolveStage) Name() string   { return "stack_resolve" }
func (StackResolveStage) Module() string { return "primary" }

func (StackResolveStage) Run(_ context.Context, tc *TurnContext, env *TurnEnvelope, _ Body) error {
	if tc == nil || tc.Stack.VM == nil {
		return &AbortError{
			Status: http.StatusServiceUnavailable,
			Body: map[string]any{
				"error": map[string]any{
					"message": "Virtual model stack unavailable",
					"type":    "gateway_config",
				},
			},
		}
	}
	env.VirtualModelID = tc.Stack.VM.ModelID
	return nil
}

// ToolRouterStage slims client tool declarations when enabled (fail-open).
type ToolRouterStage struct{}

func (ToolRouterStage) Name() string   { return "tool_router" }
func (ToolRouterStage) Module() string { return "tool_router" }

func (ToolRouterStage) Run(ctx context.Context, tc *TurnContext, env *TurnEnvelope, body Body) error {
	if tc == nil || tc.Resolved == nil {
		return nil
	}
	th := tc.Stack.ToolThresh
	if tc.HeaderToolThresh > 0 {
		th = tc.HeaderToolThresh
	}
	out, sum := transform.ApplyToolRouter(ctx, body, transform.Config{
		Enabled:      tc.Stack.ToolEnabled && !tc.SkipToolRouter,
		RouterModels: tc.Stack.RouterModels,
		Threshold:    th,
		BaseURL:      tc.Resolved.UpstreamBaseURL,
		APIKey:       tc.APIKey,
		HTTPTimeout:  tc.Timeout,
		Log:          tc.RouteLog,
		OnAttempt:    tc.OnToolRouterAttempt,
	})
	replaceBody(body, out)
	tc.ToolRouter = sum
	ApplyToolRouterToEnvelope(env, sum)
	if tc.RouteLog != nil && sum.Ran {
		errStr := ""
		if sum.Err != nil {
			errStr = sum.Err.Error()
			if len(errStr) > 300 {
				errStr = errStr[:300] + "…"
			}
		}
		tc.RouteLog.Debug("conversation tool router", "msg", naming.MsgConversationToolRouter,
			"tools_before", sum.ToolsBefore, "tools_after", sum.ToolsAfter,
			"router_model", sum.RouterModel, "virtual_model_id", tc.VirtualModelID(),
			"err", errStr, "timeline_kind", naming.TimelineKindBroker)
	}
	return nil
}

// RetrievalStage retrieves workspace context and injects a system message (fail-open).
type RetrievalStage struct{}

func (RetrievalStage) Name() string   { return "retrieval" }
func (RetrievalStage) Module() string { return "retrieval" }

func (RetrievalStage) Run(ctx context.Context, tc *TurnContext, env *TurnEnvelope, body Body) error {
	if tc == nil {
		return nil
	}
	virtualID := tc.VirtualModelID()
	coords := vectorstore.Coords{TenantID: tc.TenantID, ProjectID: tc.ProjectID, FlavorID: tc.FlavorID}
	collection := vectorstore.CollectionName(coords)
	if tc.Resolved == nil || !tc.Resolved.RAG.Enabled || tc.RAG == nil {
		if tc.RouteLog != nil {
			tc.RouteLog.Debug("conversation RAG skipped", "msg", naming.MsgConversationRagSkipped,
				"reason", "disabled", "virtual_model_id", virtualID, "timeline_kind", naming.TimelineKindVectorstore)
		}
		return nil
	}
	q := rag.LastUserText(body["messages"])
	if strings.TrimSpace(q) == "" {
		if tc.RouteLog != nil {
			tc.RouteLog.Debug("conversation RAG skipped", "msg", naming.MsgConversationRagSkipped,
				"reason", "empty_query", "virtual_model_id", virtualID, "timeline_kind", naming.TimelineKindVectorstore)
		}
		return nil
	}
	hits, rerr := tc.RAG.Retrieve(ctx, rag.RetrieveRequest{
		Coords: coords, Query: q, RequestID: tc.RequestID, ConversationID: tc.ConversationID,
		TurnIndex: tc.TurnIndex, LifecycleLog: tc.RouteLog,
	})
	if rerr != nil {
		if tc.RouteLog != nil {
			tc.RouteLog.Warn("rag retrieve failed; proceeding without context", "msg", naming.MsgRagRetrieveError,
				"err", rerr, "virtual_model_id", virtualID, "timeline_kind", naming.TimelineKindVectorstore)
		}
		return nil
	}
	if ctxBlock := rag.FormatRetrievedContext(hits); ctxBlock != "" {
		tc.RAGHits = hits
		rag.InjectSystemMessage(body, ctxBlock)
		topK := 0
		if tc.RAG != nil {
			topK = tc.RAG.TopK()
		}
		ApplyRetrievalToEnvelope(env, hits, topK)
		if tc.RouteLog != nil {
			tc.RouteLog.Info("conversation RAG attached", "msg", naming.MsgConversationRagAttached,
				"virtual_model_id", virtualID, "tenant", coords.TenantID, "project", coords.ProjectID,
				"flavor", coords.FlavorID, "hits", len(hits), "collection", collection,
				"timeline_kind", naming.TimelineKindVectorstore)
		}
	}
	return nil
}

// RequestWitnessStage logs the normalized request payload snapshot.
type RequestWitnessStage struct{}

func (RequestWitnessStage) Name() string   { return "request_witness" }
func (RequestWitnessStage) Module() string { return "telemetry" }

func (RequestWitnessStage) Run(_ context.Context, tc *TurnContext, _ *TurnEnvelope, body Body) error {
	if tc != nil && tc.EmitRequestWitness != nil {
		tc.EmitRequestWitness(tc.RouteLog, tc.Resolved, body)
	}
	return nil
}

// InitialPickStage selects the first upstream model from routing policy and chain.
type InitialPickStage struct{}

func (InitialPickStage) Name() string   { return "initial_pick" }
func (InitialPickStage) Module() string { return "primary" }

func (InitialPickStage) Run(_ context.Context, tc *TurnContext, env *TurnEnvelope, body Body) error {
	if tc == nil || tc.Stack.VM == nil {
		return nil
	}
	virtualID := tc.VirtualModelID()
	modelAvailable := tc.ModelAvailable
	if modelAvailable == nil {
		modelAvailable = func(string) bool { return true }
	}
	initial, _ := virtualmodel.PickInitialModelWithAvailability(tc.Stack.VM, body, tc.RouteLog, modelAvailable)
	if initial == "" {
		if tc.RouteLog != nil {
			tc.RouteLog.Warn("conversation errored", "msg", naming.MsgConversationErrored,
				"statusCode", http.StatusServiceUnavailable, "errorType", "gateway_config",
				"virtual_model_id", virtualID, "timeline_kind", naming.TimelineKindBroker)
		}
		errBody := map[string]any{
			"error": map[string]any{
				"message": "Could not resolve an initial upstream model for the virtual model (check routing policy and fallback chain).",
				"type":    "gateway_config",
			},
		}
		if tc.HistRec != nil {
			tc.HistRec.SetRAGHits(tc.RAGHits)
			if env != nil {
				if b, err := RedactedJSON(env); err == nil {
					tc.HistRec.SetHarnessSummary(b)
				}
			}
			tc.HistRec.PersistGatewayError(http.StatusServiceUnavailable, errBody)
		}
		return &AbortError{Status: http.StatusServiceUnavailable, Body: errBody}
	}
	tc.InitialModel = initial
	env.Plan.PrimaryModelID = &initial
	if tc.RouteLog != nil {
		tc.RouteLog.Info("chat routing resolved", "msg", naming.MsgChatRoutingResolved,
			"virtual_model_id", virtualID, "clientModel", virtualID, "upstreamModel", initial,
			"timeline_kind", naming.TimelineKindBroker)
	}
	return nil
}

// FallbackProxyStage proxies to upstream with virtual-model fallback retry semantics.
type FallbackProxyStage struct{}

func (FallbackProxyStage) Name() string   { return "fallback_proxy" }
func (FallbackProxyStage) Module() string { return "primary" }

func (FallbackProxyStage) Run(ctx context.Context, tc *TurnContext, env *TurnEnvelope, body Body) error {
	if tc == nil || tc.Resolved == nil || tc.InitialModel == "" {
		return ErrTurnComplete
	}
	rag.WriteResponseHeaders(tc.W, tc.InitialModel, tc.RAGHits)
	WriteSummaryHeader(tc.W, env)
	if tc.HistRec != nil {
		tc.HistRec.SetRAGHits(tc.RAGHits)
	}
	opts := tc.ChatOpts
	if opts == nil {
		opts = &chat.ProxyOpts{}
	} else {
		cp := *opts
		opts = &cp
	}
	if tc.ModelAvailable != nil {
		opts.ModelAvailable = tc.ModelAvailable
	}
	opts.VirtualModelID = tc.VirtualModelID()
	if env != nil {
		opts.OnFallbackAttempt = func(upstreamModel string, attempt int) {
			RecordUpstreamAttempt(env, upstreamModel, attempt)
		}
	}
	prevCaptured := opts.OnResponseCaptured
	opts.OnResponseCaptured = func(statusCode int, upstreamModel string, stream bool, body []byte) {
		if env != nil {
			SetResolvedModel(env, upstreamModel)
			if len(env.Execution.UpstreamAttempts) > 0 {
				last := len(env.Execution.UpstreamAttempts) - 1
				env.Execution.UpstreamAttempts[last].Status = statusCode
			}
			LogTurnCompleted(tc, env, statusCode)
			if tc.HistRec != nil {
				if b, err := RedactedJSON(env); err == nil {
					tc.HistRec.SetHarnessSummary(b)
				}
			}
		}
		if prevCaptured != nil {
			prevCaptured(statusCode, upstreamModel, stream, body)
		}
	}
	chat.WithVirtualModelFallback(ctx, tc.W, tc.InitialModel, tc.Stack.Fallback, tc.Resolved.UpstreamBaseURL,
		tc.APIKey, tc.Stream, body, tc.Timeout, tc.RouteLog, tc.Metrics, tc.LimitsGuard, opts)
	return ErrTurnComplete
}

func replaceBody(dst, src Body) {
	if dst == nil || src == nil {
		return
	}
	for k := range dst {
		if _, ok := src[k]; !ok {
			delete(dst, k)
		}
	}
	for k, v := range src {
		dst[k] = v
	}
}

// HandleAbort writes an AbortError response to the client.
func HandleAbort(w http.ResponseWriter, err *AbortError) {
	if w == nil || err == nil {
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(err.Status)
	_ = json.NewEncoder(w).Encode(err.Body)
}
