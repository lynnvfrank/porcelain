package operatorapi

// ErrorBody is a simple {"error": "..."} response used by several /api/ui routes.
type ErrorBody struct {
	Error  string `json:"error"`
	Detail string `json:"detail,omitempty"`
}

// RoutingConfigError is the nested error object for routing generator failures.
type RoutingConfigError struct {
	Error RoutingConfigErrorDetail `json:"error"`
}

// RoutingConfigErrorDetail carries message and type for routing JSON errors.
type RoutingConfigErrorDetail struct {
	Message string `json:"message"`
	Type    string `json:"type"`
	Status  int    `json:"status,omitempty"`
	Detail  string `json:"detail,omitempty"`
}

// OKResponse is {"ok": true} (and optional extra fields via embedding at call sites).
type OKResponse struct {
	OK bool `json:"ok"`
}
