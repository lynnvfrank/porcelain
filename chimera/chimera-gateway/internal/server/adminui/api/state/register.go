package state

import (
	"net/http"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui/handler"
)

// Register mounts GET /api/ui/state.
func Register(mux *http.ServeMux, h *handler.Handler) {
	if h == nil {
		return
	}
	mux.HandleFunc("GET /api/ui/state", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleState(h, w, r)
	}))
}
