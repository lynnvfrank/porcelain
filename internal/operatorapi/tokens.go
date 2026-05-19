package operatorapi

// TokenMeta is one row in GET /api/ui/tokens (matches chimera/internal/tokens.TokenMeta wire shape).
type TokenMeta struct {
	Index    int    `json:"index"`
	Label    string `json:"label"`
	TenantID string `json:"tenant_id"`
	Token    string `json:"token"`
}

// TokensListResponse is GET /api/ui/tokens.
type TokensListResponse struct {
	Tokens []TokenMeta `json:"tokens"`
}

// TokenCreateResponse is POST /api/ui/tokens success body.
type TokenCreateResponse struct {
	OK       bool   `json:"ok"`
	Token    string `json:"token"`
	TenantID string `json:"tenant_id"`
	Label    string `json:"label"`
	Message  string `json:"message"`
}

// TokenCreateRequest is POST /api/ui/tokens body.
type TokenCreateRequest struct {
	Label string `json:"label"`
}

// TokenDeleteRequest is POST /api/ui/tokens/delete body.
type TokenDeleteRequest struct {
	Index int `json:"index"`
}
