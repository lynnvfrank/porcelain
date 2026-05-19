package routing

import (
	"net/http"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui/handler"
)

// Register mounts routing operator API routes.
func Register(mux *http.ServeMux, h *handler.Handler) {
	if h == nil {
		return
	}
	mux.HandleFunc("POST /api/ui/routing/preview", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleRoutingPreviewPOST(h, w, r)
	}))
	mux.HandleFunc("POST /api/ui/routing/policy", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleRoutingPolicySavePOST(h, w, r)
	}))
	mux.HandleFunc("POST /api/ui/routing/fallback_chain", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleRoutingFallbackChainSavePOST(h, w, r)
	}))
	mux.HandleFunc("POST /api/ui/routing/generate", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleRoutingGeneratePOST(h, w, r)
	}))
	mux.HandleFunc("POST /api/ui/routing/evaluate", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleRoutingEvaluatePOST(h, w, r)
	}))
	mux.HandleFunc("POST /api/ui/routing/filter_free_tier_models", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleRoutingFilterFreeTierPOST(h, w, r)
	}))
	mux.HandleFunc("POST /api/ui/routing/router_tooling", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		handleRoutingRouterToolingPOST(h, w, r)
	}))
}
