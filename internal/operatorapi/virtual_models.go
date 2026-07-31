package operatorapi

import "encoding/json"

// VirtualModelSummary is a list entry for GET /api/ui/state and virtual-models list.
type VirtualModelSummary struct {
	ID                   int64    `json:"id"`
	ModelID              string   `json:"model_id"`
	Name                 string   `json:"name"`
	Version              string   `json:"version"`
	Description          string   `json:"description,omitempty"`
	Enabled              bool     `json:"enabled"`
	Visibility           string   `json:"visibility"`
	FallbackDepth        int      `json:"fallback_depth"`
	RoutingPolicyEnabled bool     `json:"routing_policy_enabled"`
	ToolRouterEnabled    bool     `json:"tool_router_enabled"`
	RouterModels         []string `json:"router_models,omitempty"`
}

// VirtualModelDetail is GET /api/ui/virtual-models/{id}.
type VirtualModelDetail struct {
	VirtualModelSummary
	RoutingPolicyYAML    string                      `json:"routing_policy_yaml,omitempty"`
	FallbackChain        []string                    `json:"fallback_chain"`
	FallbackUnavailable  []string                    `json:"fallback_unavailable,omitempty"`
	ToolRouterConfidence float64                     `json:"tool_router_confidence_threshold"`
	HarnessModules       []VirtualModelHarnessModule `json:"harness_modules,omitempty"`
	CreatedByPrincipalID string                      `json:"created_by_principal_id,omitempty"`
	CreatedAt            string                      `json:"created_at"`
	UpdatedAt            string                      `json:"updated_at"`
}

// VirtualModelCreateRequest is POST /api/ui/virtual-models body.
type VirtualModelCreateRequest struct {
	Name        string `json:"name"`
	Version     string `json:"version"`
	Description string `json:"description,omitempty"`
	Visibility  string `json:"visibility,omitempty"`
	ModelID     string `json:"model_id,omitempty"`
}

// VirtualModelUpdateRequest is PUT /api/ui/virtual-models/{id} body.
type VirtualModelUpdateRequest struct {
	Name        *string `json:"name,omitempty"`
	Version     *string `json:"version,omitempty"`
	Description *string `json:"description,omitempty"`
	Enabled     *bool   `json:"enabled,omitempty"`
	Visibility  *string `json:"visibility,omitempty"`
}

// VirtualModelFallbackSaveRequest is PUT /api/ui/virtual-models/{id}/fallback.
type VirtualModelFallbackSaveRequest struct {
	FallbackChain []string `json:"fallback_chain"`
}

// VirtualModelRoutingPolicySaveRequest is PUT /api/ui/virtual-models/{id}/routing-policy.
type VirtualModelRoutingPolicySaveRequest struct {
	Enabled           bool   `json:"enabled"`
	RoutingPolicyYAML string `json:"routing_policy_yaml"`
}

// VirtualModelToolRouterSaveRequest is PUT /api/ui/virtual-models/{id}/tool-router.
type VirtualModelToolRouterSaveRequest struct {
	Enabled             bool     `json:"tool_router_enabled"`
	RouterModels        []string `json:"router_models"`
	ConfidenceThreshold float64  `json:"confidence_threshold"`
}

// VirtualModelHarnessModule is one harness module on a virtual model.
type VirtualModelHarnessModule struct {
	ModuleID   string          `json:"module_id"`
	Enabled    bool            `json:"enabled"`
	ConfigJSON json.RawMessage `json:"config_json,omitempty"`
	// UI hints (read-only on GET)
	Configurable   bool   `json:"configurable,omitempty"`
	DisabledReason string `json:"disabled_reason,omitempty"`
}

// VirtualModelHarnessResponse is GET /api/ui/virtual-models/{id}/harness.
type VirtualModelHarnessResponse struct {
	Modules []VirtualModelHarnessModule `json:"modules"`
}

// VirtualModelHarnessSaveRequest is PUT /api/ui/virtual-models/{id}/harness.
type VirtualModelHarnessSaveRequest struct {
	Modules []VirtualModelHarnessModule `json:"modules"`
}

// VirtualModelHarnessEvaluateRequest is a dry-run pre-primary harness input.
type VirtualModelHarnessEvaluateRequest struct {
	Message string `json:"message"`
	Project string `json:"project,omitempty"`
	Flavor  string `json:"flavor,omitempty"`
}

// VirtualModelHarnessEvaluateResponse is a redacted dry-run envelope.
type VirtualModelHarnessEvaluateResponse struct {
	OK       bool            `json:"ok"`
	Envelope json.RawMessage `json:"envelope"`
}

// VirtualModelListResponse is GET /api/ui/virtual-models.
type VirtualModelListResponse struct {
	VirtualModels []VirtualModelSummary `json:"virtual_models"`
}

// VirtualModelGenerateRequest is POST /api/ui/virtual-models/{id}/routing/generate.
type VirtualModelGenerateRequest struct {
	ProviderPrefix string `json:"provider_prefix,omitempty"`
	Save           bool   `json:"save"`
}

// RoutingRuleDefinitionSummary is one catalog entry.
type RoutingRuleDefinitionSummary struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description,omitempty"`
}
