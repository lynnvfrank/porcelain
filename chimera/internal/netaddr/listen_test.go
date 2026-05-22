package netaddr

import (
	"testing"

	"github.com/lynn/porcelain/chimera/internal/config"
)

func TestListenAddrOverride(t *testing.T) {
	r := &config.Resolved{ListenHost: "127.0.0.1", ListenPort: 3000}
	if ListenAddrOverride(r, "") != "127.0.0.1:3000" {
		t.Fatal(ListenAddrOverride(r, ""))
	}
	if ListenAddrOverride(r, ":4000") != "127.0.0.1:4000" {
		t.Fatal()
	}
	if ListenAddrOverride(r, "0.0.0.0:9") != "0.0.0.0:9" {
		t.Fatal()
	}
}

func TestLoopbackProbeHost(t *testing.T) {
	cases := map[string]string{
		"":          "127.0.0.1",
		"0.0.0.0":   "127.0.0.1",
		"::":        "::1",
		"[::]":      "::1",
		"127.0.0.1": "127.0.0.1",
		"10.0.0.1":  "10.0.0.1",
	}
	for in, want := range cases {
		if got := LoopbackProbeHost(in); got != want {
			t.Fatalf("LoopbackProbeHost(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestProbeListenAddr(t *testing.T) {
	if got := ProbeListenAddr("0.0.0.0:3000"); got != "127.0.0.1:3000" {
		t.Fatalf("got %q", got)
	}
	if got := ProbeListenAddr("[::]:6333"); got != "[::1]:6333" {
		t.Fatalf("got %q", got)
	}
}
