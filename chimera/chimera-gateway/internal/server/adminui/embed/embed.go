package embed

import (
	"embed"
	"net/http"
	"strings"
)

//go:embed embedui/login.html embedui/logs.html embedui/logs.css embedui/ui.css embedui/theme-tokens.css embedui/styles/* embedui/ui/* embedui/ui/*/* embedui/logs_app.js embedui/logs_entry.js embedui/logs/* embedui/logs/*/* embedui/shell.html embedui/pwa.html embedui/reload.svg embedui/setup.html
var fs embed.FS

// ReadFile returns bytes for an embedded operator UI asset (e.g. embedui/setup.html).
func ReadFile(name string) ([]byte, error) {
	return fs.ReadFile(name)
}

// ServeHTML returns a handler that serves one embedded HTML page.
func ServeHTML(name string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		b, err := fs.ReadFile(name)
		if err != nil {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(b)
	}
}

// ServeAsset returns a handler for a single embedded asset with a fixed content type.
func ServeAsset(name, contentType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		b, err := fs.ReadFile(name)
		if err != nil {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		if contentType != "" {
			w.Header().Set("Content-Type", contentType)
		}
		_, _ = w.Write(b)
	}
}

// ServePathPrefix serves files under embedPrefix at urlPrefix with the given content type.
func ServePathPrefix(embedPrefix, urlPrefix, contentType string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, urlPrefix)
		p = strings.TrimSpace(p)
		if p == "" || strings.Contains(p, "..") || strings.HasPrefix(p, "/") || strings.ContainsAny(p, "\\") {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		b, err := fs.ReadFile(embedPrefix + p)
		if err != nil {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Content-Type", contentType)
		_, _ = w.Write(b)
	}
}
