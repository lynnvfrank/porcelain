package auth

import (
	"encoding/json"
	"net/http"

	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui/embed"
	"github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/adminui/handler"
)

func handleLoginGET(h *handler.Handler, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if h.SessionOK(r) {
		http.Redirect(w, r, handler.SanitizeLoginNext(r.URL.Query().Get("next")), http.StatusFound)
		return
	}
	if tok := handler.EnvLoginToken(); tok != "" {
		ok, srvErr := h.SetSessionCookie(w, tok)
		if srvErr {
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		if ok {
			http.Redirect(w, r, handler.SanitizeLoginNext(r.URL.Query().Get("next")), http.StatusFound)
			return
		}
	}
	embed.ServeHTML("embedui/login.html")(w, r)
}

func handleLoginPOST(h *handler.Handler, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Token string `json:"token"`
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20))
	if err := dec.Decode(&body); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "invalid json"})
		return
	}
	ok, srvErr := h.SetSessionCookie(w, body.Token)
	if srvErr {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": "invalid token"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
}
