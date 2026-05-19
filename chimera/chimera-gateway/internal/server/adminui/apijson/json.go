package apijson

import (
	"encoding/json"
	"net/http"
	"strings"
)

const maxProviderErrorBody = 2048

// WriteError writes a standard operator UI JSON error body.
func WriteError(w http.ResponseWriter, code int, msg, detail string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error":  msg,
		"detail": detail,
	})
}

// TruncateErrMsg caps error text for JSON responses.
func TruncateErrMsg(s string) string {
	s = strings.TrimSpace(s)
	if len(s) <= maxProviderErrorBody {
		return s
	}
	return s[:maxProviderErrorBody] + "…"
}
