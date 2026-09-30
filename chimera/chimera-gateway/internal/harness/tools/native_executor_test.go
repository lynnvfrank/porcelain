package tools

import (
	"context"
	"testing"
)

func TestNativeExecutor_reservedNamesInDeclarations(t *testing.T) {
	for _, name := range []string{"workspace_context_around", "workspace_adjacent_chunks", "workspace_read_lines"} {
		if !IsReservedNativeName(name) {
			t.Fatalf("missing reserved name %q", name)
		}
	}
	decls := OpenAIToolDeclarations(true)
	if len(decls) != 7 {
		t.Fatalf("want 7 decls, got %d", len(decls))
	}
	declsBase := OpenAIToolDeclarations(false)
	if len(declsBase) != 4 {
		t.Fatalf("want 4 base decls, got %d", len(declsBase))
	}
}

func TestCompositeNativeWinsExpansionName(t *testing.T) {
	ws := NewWorkspaceExecutor(nil, PolicyRead)
	comp := &CompositeExecutor{Native: &NativeExecutor{Workspace: ws, Expansion: nil}}
	args := []byte(`{"source":"x","line":1,"content_sha256":"sha"}`)
	got, _ := comp.Invoke(context.Background(), ToolCall{Name: "workspace_context_around", Arguments: args})
	if !got.IsError || got.Content != "rag expansion tools unavailable" {
		t.Fatalf("expected expansion unavailable, got %+v", got)
	}
}
