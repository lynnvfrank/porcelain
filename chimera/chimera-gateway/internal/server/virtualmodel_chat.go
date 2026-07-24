package server

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/chat"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/conversationhistory"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/harness"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/operatorstore"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/virtualmodel"
	"github.com/lynn/porcelain/chimera/internal/config"
)

func virtualModelsForCatalog(rt *Runtime, principalID string) []*virtualmodel.Resolved {
	reg := rt.VirtualModels()
	if reg != nil {
		return reg.ListCatalog(principalID)
	}
	return nil
}

func openAIModelEntry(id, description string) map[string]any {
	entry := map[string]any{
		"id":       id,
		"object":   "model",
		"created":  time.Now().Unix(),
		"owned_by": "chimera",
	}
	if strings.TrimSpace(description) != "" {
		entry["description"] = description
	}
	return entry
}

func prependVirtualModelsToCatalog(data []any, rt *Runtime, principalID string) []any {
	vms := virtualModelsForCatalog(rt, principalID)
	if len(vms) == 0 {
		return data
	}
	out := make([]any, 0, len(vms)+len(data))
	for _, vm := range vms {
		out = append(out, openAIModelEntry(vm.ModelID, vm.Description))
	}
	return append(out, data...)
}

type virtualModelChatContext struct {
	vm           *virtualmodel.Resolved
	fallback     []string
	toolEnabled  bool
	routerModels []string
	toolThresh   float64
}

func resolveVirtualModelChat(rt *Runtime, clientModel, principalID string) (*virtualModelChatContext, int, map[string]any) {
	reg := rt.VirtualModels()
	if reg == nil {
		return nil, 0, nil
	}
	vm, err := reg.Resolve(clientModel, principalID)
	if err == nil {
		return &virtualModelChatContext{
			vm:           vm,
			fallback:     vm.FallbackChain,
			toolEnabled:  vm.ToolRouterEnabled,
			routerModels: vm.RouterModels,
			toolThresh:   vm.ToolRouterConfidence,
		}, 0, nil
	}
	if errors.Is(err, virtualmodel.ErrForbidden) {
		return nil, http.StatusForbidden, map[string]any{
			"error": map[string]any{"message": "Virtual model not accessible", "type": "invalid_request"},
		}
	}
	if store := rt.OperatorStore(); store != nil && errors.Is(err, virtualmodel.ErrNotFound) {
		row, dbErr := store.GetVirtualModelByModelID(context.Background(), clientModel)
		if dbErr == nil && row != nil {
			if !row.Enabled {
				return nil, http.StatusNotFound, map[string]any{
					"error": map[string]any{"message": "Virtual model is disabled", "type": "invalid_request"},
				}
			}
			if row.Visibility == operatorstore.VisibilityPrivate &&
				row.CreatedByPrincipalID != "" && row.CreatedByPrincipalID != principalID {
				return nil, http.StatusForbidden, map[string]any{
					"error": map[string]any{"message": "Virtual model not accessible", "type": "invalid_request"},
				}
			}
		}
	}
	return nil, 0, nil
}

func routeLogWithVirtualModel(routeLog *slog.Logger, virtualModelID string) *slog.Logger {
	if routeLog == nil || virtualModelID == "" {
		return routeLog
	}
	return routeLog.With("virtual_model_id", virtualModelID)
}

func handleVirtualModelChat(
	ctx context.Context,
	w http.ResponseWriter,
	rt *Runtime,
	res *config.Resolved,
	vmCtx *virtualModelChatContext,
	raw map[string]json.RawMessage,
	stream bool,
	skipToolRouter bool,
	headerThresh float64,
	routeLog *slog.Logger,
	cid string,
	turnIdx int,
	rid string,
	sessTenant string,
	proj string,
	flav string,
	apiKey string,
	rtDur time.Duration,
	chatOpts *chat.ProxyOpts,
	histRec *conversationhistory.Recorder,
) bool {
	vm := vmCtx.vm
	if vm == nil {
		return false
	}
	virtualID := vm.ModelID
	routeLog = routeLogWithVirtualModel(routeLog, virtualID)

	tenantSnap := rt.ProviderModelAvailability(sessTenant)
	modelAvailable := func(id string) bool { return tenantSnap.IsAvailable(id) }

	tc := &harness.TurnContext{
		W:                w,
		Resolved:         res,
		Stack: harness.VMStack{
			VM:           vm,
			Fallback:     vmCtx.fallback,
			ToolEnabled:  vmCtx.toolEnabled,
			RouterModels: vmCtx.routerModels,
			ToolThresh:   vmCtx.toolThresh,
		},
		Stream:           stream,
		SkipToolRouter:   skipToolRouter,
		HeaderToolThresh: headerThresh,
		RouteLog:         routeLog,
		ConversationID:   cid,
		TurnIndex:        turnIdx,
		RequestID:        rid,
		TenantID:         sessTenant,
		ProjectID:        proj,
		FlavorID:         flav,
		APIKey:           apiKey,
		Timeout:          rtDur,
		ChatOpts:         chatOpts,
		HistRec:          histRec,
		RAG:              rt.RAG(),
		Metrics:          rt.Metrics(),
		LimitsGuard:      rt.LimitsGuard(),
		ModelAvailable:   modelAvailable,
		OnToolRouterAttempt: func(model string, err error) {
			rt.NoteToolRouterAttempt(model, err)
		},
		EmitRequestWitness: emitConversationRequestWitness,
	}

	err := harness.DefaultRunner().Run(ctx, tc, harness.Body(raw))
	if err != nil {
		var abort *harness.AbortError
		if errors.As(err, &abort) {
			if tc.Envelope != nil {
				harness.LogTurnCompleted(tc, tc.Envelope, abort.Status)
			}
			harness.HandleAbort(w, abort)
			return true
		}
		return false
	}
	return true
}
