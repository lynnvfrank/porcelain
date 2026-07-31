package harness

import (
	"context"
	"strings"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/harness/tools"
	"github.com/lynn/porcelain/internal/naming"
)

// MetaPolicyStage resolves the server-owned workspace scope before any
// LLM-assisted stage. A cloud route is identified conservatively as a
// provider/model id whose provider is not Ollama; bare ids stay eligible.
type MetaPolicyStage struct{}

func (MetaPolicyStage) Name() string   { return "meta_policy" }
func (MetaPolicyStage) Module() string { return "meta_policy" }

func (MetaPolicyStage) Run(ctx context.Context, tc *TurnContext, env *TurnEnvelope, _ Body) error {
	if tc == nil || env == nil || tc.OperatorStore == nil {
		return nil
	}
	workspace, matchedIDs, err := tc.OperatorStore.ResolveWorkspaceScope(ctx, tc.TenantID, tc.ProjectID, tc.FlavorID)
	if err != nil {
		if tc.RouteLog != nil {
			tc.RouteLog.Warn("workspace scope resolution failed; proceeding without workspace policy",
				"err", err, "virtual_model_id", tc.VirtualModelID(), "turn_index", tc.TurnIndex,
				"timeline_kind", naming.TimelineKindBroker)
		}
		return nil
	}
	if workspace == nil {
		return nil
	}
	tc.WorkspaceScope = workspace
	tc.WorkspaceRoots = tc.WorkspaceRoots[:0]
	for _, path := range workspace.Paths {
		tc.WorkspaceRoots = append(tc.WorkspaceRoots, path.Path)
	}
	tc.ToolExecutor = tools.NewWorkspaceExecutor(tc.WorkspaceRoots, workspace.FileActionPolicy)
	env.Scope.WorkspaceID = &workspace.ID
	env.Scope.Sensitivity = workspace.Sensitivity
	env.Scope.AllowCloud = boolPtr(workspace.AllowCloud)
	env.Scope.WorkspacePermission = workspace.FileActionPolicy

	if len(matchedIDs) > 1 && tc.RouteLog != nil {
		tc.RouteLog.Info("multiple workspaces matched policy scope; selected lowest id",
			"msg", naming.MsgHarnessScopeWorkspaceAmbiguous,
			"matched_ids", matchedIDs, "chosen_id", workspace.ID,
			"virtual_model_id", tc.VirtualModelID(), "turn_index", tc.TurnIndex,
			"timeline_kind", naming.TimelineKindBroker)
	}
	if !workspace.AllowCloud {
		filterCloudFallback(tc)
	}
	return nil
}

func boolPtr(v bool) *bool { return &v }

func filterCloudFallback(tc *TurnContext) {
	if tc == nil || len(tc.Stack.Fallback) == 0 {
		return
	}
	original := append([]string(nil), tc.Stack.Fallback...)
	filtered := make([]string, 0, len(original))
	for _, modelID := range original {
		if !looksCloudOnly(modelID) {
			filtered = append(filtered, modelID)
		}
	}
	if len(filtered) == 0 {
		if tc.RouteLog != nil {
			tc.RouteLog.Warn("workspace cloud policy removed every fallback candidate; restoring chain fail-open",
				"virtual_model_id", tc.VirtualModelID(), "turn_index", tc.TurnIndex,
				"timeline_kind", naming.TimelineKindBroker)
		}
		return
	}
	tc.Stack.Fallback = filtered
}

func looksCloudOnly(modelID string) bool {
	parts := strings.SplitN(strings.TrimSpace(modelID), "/", 2)
	return len(parts) == 2 && strings.TrimSpace(parts[0]) != "" && !strings.EqualFold(parts[0], "ollama")
}
