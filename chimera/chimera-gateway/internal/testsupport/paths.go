// Package testsupport resolves repo-root paths for chimera-gateway tests.
package testsupport

import (
	"path/filepath"
	"runtime"
	"testing"
)

func repoRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	// .../chimera/chimera-gateway/internal/testsupport/paths.go → module root.
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", "..", "..", ".."))
}

// GatewayMetricsMigrationsDir is migrations/chimera-gateway/metrics at the repo root.
func GatewayMetricsMigrationsDir(t *testing.T) string {
	t.Helper()
	return filepath.Join(repoRoot(t), "migrations", "chimera-gateway", "metrics")
}

// GatewayOperatorMigrationsDir is migrations/chimera-gateway/operator at the repo root.
func GatewayOperatorMigrationsDir(t *testing.T) string {
	t.Helper()
	return filepath.Join(repoRoot(t), "migrations", "chimera-gateway", "operator")
}
