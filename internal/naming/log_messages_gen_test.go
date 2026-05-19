package naming_test

import (
	"bytes"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"

	"github.com/lynn/porcelain/internal/operatorcopy"
	"github.com/lynn/porcelain/internal/operatorcopy/genlogmessages"
)

func TestGeneratedLogMessagesGoMatchesFile(t *testing.T) {
	reg, err := operatorcopy.LoadEmbedded()
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(repoRootNaming(t), filepath.FromSlash(genlogmessages.DefaultLogMessagesGoPath))

	var buf bytes.Buffer
	if err := genlogmessages.WriteLogMessagesGo(&buf, reg); err != nil {
		t.Fatal(err)
	}
	want := buf.String()

	onDisk, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read %s: %v", path, err)
	}
	if string(onDisk) != want {
		t.Fatalf("%s is stale; run: go generate ./internal/operatorcopy/...", path)
	}
}

func TestLogMessageConstsHaveRegistryEntry(t *testing.T) {
	reg, err := operatorcopy.LoadEmbedded()
	if err != nil {
		t.Fatal(err)
	}
	bySlug := make(map[string]struct{}, len(reg.Messages))
	for _, m := range reg.Messages {
		if m.Summary == "" && m.Formatter == "" {
			t.Fatalf("registry slug %q has neither summary nor formatter", m.Slug)
		}
		bySlug[m.Slug] = struct{}{}
	}
	for slug := range allLogMessageSlugValues(t) {
		if _, ok := bySlug[slug]; !ok {
			t.Fatalf("log_messages const value %q missing from operatorcopy registry", slug)
		}
	}
}

func allLogMessageSlugValues(t *testing.T) map[string]struct{} {
	t.Helper()
	path := filepath.Join(repoRootNaming(t), filepath.FromSlash(genlogmessages.DefaultLogMessagesGoPath))
	fset := token.NewFileSet()
	f, err := parser.ParseFile(fset, path, nil, 0)
	if err != nil {
		t.Fatal(err)
	}
	out := make(map[string]struct{})
	for _, decl := range f.Decls {
		gen, ok := decl.(*ast.GenDecl)
		if !ok || gen.Tok != token.CONST {
			continue
		}
		for _, spec := range gen.Specs {
			vs, ok := spec.(*ast.ValueSpec)
			if !ok {
				continue
			}
			for i, name := range vs.Names {
				if !strings.HasPrefix(name.Name, "Msg") {
					continue
				}
				if i >= len(vs.Values) {
					t.Fatalf("const %s missing value", name.Name)
				}
				if lit, ok := vs.Values[i].(*ast.BasicLit); ok && lit.Kind == token.STRING {
					if s, err := strconv.Unquote(lit.Value); err == nil && s != "" {
						out[s] = struct{}{}
					}
				}
			}
		}
	}
	return out
}

func repoRootNaming(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime.Caller failed")
	}
	dir := filepath.Dir(file)
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("go.mod not found")
		}
		dir = parent
	}
}
