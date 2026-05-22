package supervise

import (
	"slices"
	"testing"
)

func TestAppendBackendLogLevel(t *testing.T) {
	base := []string{"-listen", "127.0.0.1:8080"}
	got := appendBackendLogLevel(base, "")
	if !slices.Equal(got, base) {
		t.Fatalf("empty level: got %v want %v", got, base)
	}
	got = appendBackendLogLevel(base, "debug")
	want := []string{"-listen", "127.0.0.1:8080", "-log-level", "debug"}
	if !slices.Equal(got, want) {
		t.Fatalf("debug level: got %v want %v", got, want)
	}
}

func TestWrapperArgsDoesNotForwardUpstreamDebugFlag(t *testing.T) {
	base := []string{"-listen", "127.0.0.1:6333", "-bin", "qdrant"}
	got := WrapperArgs(base)
	if !slices.Equal(got, base) {
		t.Fatalf("WrapperArgs() = %v, want copy of %v", got, base)
	}
	for _, arg := range got {
		if arg == "-debug-forward-upstream" {
			t.Fatalf("WrapperArgs must not append -debug-forward-upstream under supervision")
		}
	}
}
