package session

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"

	"github.com/lynn/porcelain/chimera/internal/servicelogs"
)

// DefaultUICookieName is the operator UI session cookie name.
const DefaultUICookieName = "chimera_ui_session"

const defaultSessionTTL = 24 * time.Hour

// Store holds short-lived admin UI sessions after gateway token login.
type Store struct {
	mu   sync.Mutex
	ttl  time.Duration
	byID map[string]time.Time
}

func newStore(ttl time.Duration) *Store {
	if ttl <= 0 {
		ttl = defaultSessionTTL
	}
	return &Store{
		ttl:  ttl,
		byID: make(map[string]time.Time),
	}
}

// Issue creates a session id after the caller has validated the gateway token.
func (s *Store) Issue() (id string, err error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	id = hex.EncodeToString(b[:])
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked()
	s.byID[id] = time.Now().Add(s.ttl)
	return id, nil
}

// Valid reports whether id is a non-expired session.
func (s *Store) Valid(id string) bool {
	if id == "" {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.pruneLocked()
	exp, ok := s.byID[id]
	if !ok || time.Now().After(exp) {
		return false
	}
	return true
}

// Revoke removes a session id.
func (s *Store) Revoke(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.byID, id)
}

func (s *Store) pruneLocked() {
	now := time.Now()
	for k, exp := range s.byID {
		if now.After(exp) {
			delete(s.byID, k)
		}
	}
}

// UIOptions configures operator UI routes (session cookie + /ui + /api/ui). Nil disables UI.
type UIOptions struct {
	Sessions *Store
	// CookieName defaults to chimera_ui_session.
	CookieName string
	// LogStore enables /api/ui/logs and /api/ui/logs/stream (session auth). Nil omits those routes.
	LogStore *servicelogs.Store
}

// SessionCookieName returns the configured session cookie name.
func (o *UIOptions) SessionCookieName() string {
	if o == nil {
		return DefaultUICookieName
	}
	if n := o.CookieName; n != "" {
		return n
	}
	return DefaultUICookieName
}

// NewUIOptions returns UIOptions with an in-memory session store (production: same process as gateway).
func NewUIOptions() *UIOptions {
	return &UIOptions{
		Sessions: newStore(defaultSessionTTL),
	}
}
