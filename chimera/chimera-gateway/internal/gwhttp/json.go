package gwhttp

import (
	"encoding/json"
	"net/http"
)

// WriteJSONError writes a gateway-style OpenAI error envelope.
func WriteJSONError(w http.ResponseWriter, status int, message, errType string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]any{"message": message, "type": errType},
	})
}
