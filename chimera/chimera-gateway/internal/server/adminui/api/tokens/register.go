package tokens

import (
	"net/http"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui/handler"
)

// Register mounts gateway token admin routes.
func Register(mux *http.ServeMux, h *handler.Handler) {
	if h == nil {
		return
	}
	mux.HandleFunc("GET /api/ui/tokens", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleTokensList(h, w, r)
	}))
	mux.HandleFunc("POST /api/ui/tokens", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleTokensCreate(h, w, r)
	}))
	mux.HandleFunc("POST /api/ui/tokens/delete", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleTokensDelete(h, w, r)
	}))
}
