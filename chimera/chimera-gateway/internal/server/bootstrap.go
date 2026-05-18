package server

import gruntime "github.com/lynn/porcelain/chimera/chimera-gateway/internal/server/runtime"

// BootstrapMode reports whether the gateway should serve the limited bootstrap surface.
func BootstrapMode(rt *Runtime) bool {
	return gruntime.BootstrapMode(rt)
}
