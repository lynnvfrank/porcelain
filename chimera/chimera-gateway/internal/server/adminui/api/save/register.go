package save

import (
	"net/http"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui/handler"
)

// Register mounts provider save and logout routes.
func Register(mux *http.ServeMux, h *handler.Handler) {
	if h == nil {
		return
	}
	for _, p := range []string{"groq", "gemini"} {
		prov := p
		mux.HandleFunc("POST /api/ui/provider/"+prov+"/keys", h.RequireAuthJSON(saveAppendProviderKey(h, prov)))
		mux.HandleFunc("POST /api/ui/provider/"+prov+"/keys/delete", h.RequireAuthJSON(saveRemoveProviderKey(h, prov)))
	}
	mux.HandleFunc("POST /api/ui/provider/ollama/base_url", h.RequireAuthJSON(func(w http.ResponseWriter, r *http.Request) {
		saveOllamaBaseURL(h, w, r)
	}))
	mux.HandleFunc("POST /api/ui/logout", func(w http.ResponseWriter, r *http.Request) {
		handleLogoutPOST(h, w, r)
	})
}
