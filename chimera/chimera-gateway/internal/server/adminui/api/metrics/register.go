package metrics

import (
	"net/http"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui/handler"
)

// Register mounts /api/ui/metrics.
func Register(mux *http.ServeMux, h *handler.Handler) {
	if h == nil {
		return
	}
	mux.HandleFunc("GET /api/ui/metrics", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleMetricsGET(h, w, r)
	}))
}
