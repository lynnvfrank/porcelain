package indexer

import (
	"path/filepath"
	"testing"
)

func TestDistinctIndexerTargetKeys_multiRootProjects(t *testing.T) {
	a := filepath.Join(t.TempDir(), "a")
	b := filepath.Join(t.TempDir(), "b")
	c := filepath.Join(t.TempDir(), "c")
	gw := &IndexerConfig{}
	gw.Defaults.ProjectID = "fallback"
	r := Resolved{
		Roots: []Root{
			{ID: "r1", AbsPath: a, Scope: ScopeFragment{ProjectID: "assistants"}},
			{ID: "r2", AbsPath: b, Scope: ScopeFragment{ProjectID: "minecraft"}},
			{ID: "r3", AbsPath: c, Scope: ScopeFragment{ProjectID: "minecraft"}},
		},
	}
	keys := DistinctIndexerTargetKeys(r, gw)
	if len(keys) != 2 {
		t.Fatalf("expected 2 distinct keys (minecraft dedup), got %#v", keys)
	}
}

func TestRootScopesPayload_OrderAndKeys(t *testing.T) {
	a := filepath.Join(t.TempDir(), "a")
	b := filepath.Join(t.TempDir(), "b")
	r := Resolved{
		Roots: []Root{
			{ID: "r1", AbsPath: a, Scope: ScopeFragment{ProjectID: "p1"}},
			{ID: "r2", AbsPath: b, Scope: ScopeFragment{ProjectID: "p2"}},
		},
	}
	gw := &IndexerConfig{TenantID: "tenant-test"}
	raw := RootScopesPayload(r, gw)
	if len(raw) < 20 {
		t.Fatalf("short json: %s", raw)
	}
	ss := DistinctIndexerTargetKeys(r, gw)
	if len(ss) != 2 {
		t.Fatalf("distinct: %v", ss)
	}
}
