package netaddr

import (
	"net"
	"strings"

	"github.com/lynn/porcelain/chimera/internal/config"
)

// ListenAddrOverride applies -listen flag semantics: "host:port" or ":port".
func ListenAddrOverride(res *config.Resolved, listenFlag string) string {
	if strings.TrimSpace(listenFlag) == "" {
		return res.ListenAddr()
	}
	if strings.HasPrefix(listenFlag, ":") {
		return res.ListenHost + listenFlag
	}
	return listenFlag
}

// LoopbackProbeHost maps an unspecified bind host to a loopback address for local HTTP probes.
func LoopbackProbeHost(host string) string {
	h := strings.TrimSpace(host)
	switch h {
	case "", "0.0.0.0":
		return "127.0.0.1"
	case "::", "[::]":
		return "::1"
	default:
		if strings.HasPrefix(h, "[") && strings.HasSuffix(h, "]") {
			if inner := strings.Trim(h, "[]"); inner == "::" {
				return "::1"
			}
		}
		return h
	}
}

// ProbeListenAddr returns host:port suitable for wrapper readiness probes against a local backend.
func ProbeListenAddr(hostPort string) string {
	host, port, err := net.SplitHostPort(strings.TrimSpace(hostPort))
	if err != nil {
		return hostPort
	}
	return net.JoinHostPort(LoopbackProbeHost(host), port)
}
