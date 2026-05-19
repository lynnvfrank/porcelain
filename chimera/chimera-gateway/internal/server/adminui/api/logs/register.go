package logs

import (
	"net/http"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui/handler"
)

// Register mounts /api/ui/logs routes when LogStore is configured.
func Register(mux *http.ServeMux, h *handler.Handler) {
	if h == nil || h.Opts == nil || h.Opts.LogStore == nil {
		return
	}
	mux.HandleFunc("GET /api/ui/logs", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleLogsPoll(h, w, r)
	}))
	mux.HandleFunc("GET /api/ui/logs/stream", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleLogsStream(h, w, r)
	}))
}
