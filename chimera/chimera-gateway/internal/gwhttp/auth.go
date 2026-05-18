package gwhttp

import "strings"

// BearerToken returns the token from an Authorization: Bearer header, or "".
func BearerToken(h string) string {
	h = strings.TrimSpace(h)
	const p = "Bearer "
	if len(h) <= len(p) || !strings.EqualFold(h[:len(p)], p) {
		return ""
	}
	return strings.TrimSpace(h[len(p):])
}

// RedactBearerAuth returns a redacted Authorization header value for logs.
func RedactBearerAuth(h string) string {
	h = strings.TrimSpace(h)
	const p = "Bearer "
	if !strings.HasPrefix(strings.ToLower(h), strings.ToLower(p)) {
		return ""
	}
	tok := strings.TrimSpace(h[len(p):])
	if len(tok) <= 8 {
		return "Bearer ***"
	}
	return "Bearer " + tok[:4] + "…"
}
