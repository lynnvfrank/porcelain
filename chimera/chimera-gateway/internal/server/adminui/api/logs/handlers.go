package logs

import (
	"net/http"
	"net/url"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui/handler"
	"github.com/lynn/porcelain/chimera/internal/servicelogs"
)

func handleLogsPoll(h *handler.Handler, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	store := h.Opts.LogStore
	if store == nil {
		http.Error(w, "logs unavailable", http.StatusNotFound)
		return
	}
	servicelogs.HandleLogsPoll(store, w, r)
}

func handleLogsStream(h *handler.Handler, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	store := h.Opts.LogStore
	if store == nil {
		http.Error(w, "logs unavailable", http.StatusNotFound)
		return
	}
	// Operator UI replays a short tail on connect; full buffer is available via poll/backfill.
	q := r.URL.Query()
	if q.Get("replay") == "" {
		q.Set("replay", string(servicelogs.ReplayTail))
	}
	if q.Get("tail") == "" {
		q.Set("tail", "200")
	}
	r2 := r.Clone(r.Context())
	r2.URL = &url.URL{
		Path:     r.URL.Path,
		RawQuery: q.Encode(),
	}
	servicelogs.HandleLogsStream(store, w, r2)
}
