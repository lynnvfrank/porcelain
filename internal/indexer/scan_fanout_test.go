package indexer

import (
	"testing"
)

func TestComputePerScopeBudget(t *testing.T) {
	cfg := Resolved{QueueDepth: 10, QueueFanoutHWMPercent: 75}
	ix := New(cfg, nil, nil)
	if g := ix.computePerScopeBudget(2); g != 3 {
		t.Fatalf("N=2: got %d want 3 (floor(10*0.75/2))", g)
	}
	if g := ix.computePerScopeBudget(1); g != 7 {
		t.Fatalf("N=1: got %d want 7 (floor(10*0.75/1))", g)
	}
}

func TestComputePerScopeBudget_UnboundedQueue(t *testing.T) {
	cfg := Resolved{QueueDepth: 0, QueueFanoutHWMPercent: 75}
	ix := New(cfg, nil, nil)
	if g := ix.computePerScopeBudget(5); g < 1000 {
		t.Fatalf("unbounded queue should yield large budget, got %d", g)
	}
}
