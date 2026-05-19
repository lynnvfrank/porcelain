package auth

import (
	"net/http"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui/handler"
)

// Register mounts login routes (page + JSON).
func Register(mux *http.ServeMux, h *handler.Handler) {
	if h == nil {
		return
	}
	mux.HandleFunc("GET /ui/login", func(w http.ResponseWriter, r *http.Request) {
		handleLoginGET(h, w, r)
	})
	mux.HandleFunc("POST /api/ui/login", func(w http.ResponseWriter, r *http.Request) {
		handleLoginPOST(h, w, r)
	})
}
