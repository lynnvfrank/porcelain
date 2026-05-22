package line

import (
	"bytes"
	"log/slog"
	"strings"
	"testing"
)

func TestLineMeetsMinLevel(t *testing.T) {
	debugLine := `{"level":"DEBUG","service":"chimera-vectorstore","msg":"vectorstore.http.access_other","_chimera_norm":1}`
	infoLine := `{"level":"INFO","service":"chimera-vectorstore","msg":"vectorstore.ready","_chimera_norm":1}`
	warnLine := `{"level":"WARN","service":"chimera-vectorstore","msg":"vectorstore.config.optional_missing","_chimera_norm":1}`

	if LineMeetsMinLevel(debugLine, slog.LevelInfo) {
		t.Fatal("DEBUG should not meet INFO min")
	}
	if !LineMeetsMinLevel(infoLine, slog.LevelInfo) {
		t.Fatal("INFO should meet INFO min")
	}
	if !LineMeetsMinLevel(warnLine, slog.LevelInfo) {
		t.Fatal("WARN should meet INFO min")
	}
	if !LineMeetsMinLevel(debugLine, slog.LevelDebug) {
		t.Fatal("DEBUG should meet DEBUG min")
	}
	if !LineMeetsMinLevel(`plain banner line`, slog.LevelInfo) {
		t.Fatal("plain text defaults to INFO")
	}
	if !LineMeetsMinLevel(`{"service":"x","msg":"y"}`, slog.LevelInfo) {
		t.Fatal("missing level defaults to INFO")
	}
}

func TestNewLevelFilterWriter(t *testing.T) {
	var buf bytes.Buffer
	w := NewLevelFilterWriter(&buf, slog.LevelInfo)
	if _, err := w.Write([]byte("{\"level\":\"DEBUG\",\"msg\":\"a\"}\n{\"level\":\"INFO\",\"msg\":\"b\"}\n")); err != nil {
		t.Fatal(err)
	}
	out := buf.String()
	if strings.Contains(out, `"msg":"a"`) {
		t.Fatalf("DEBUG line leaked: %q", out)
	}
	if !strings.Contains(out, `"msg":"b"`) {
		t.Fatalf("INFO line missing: %q", out)
	}
}

func TestParseLogLevel(t *testing.T) {
	if ParseLogLevel("debug") != slog.LevelDebug {
		t.Fatal("debug")
	}
	if ParseLogLevel("warning") != slog.LevelWarn {
		t.Fatal("warning")
	}
	if ParseLogLevel("") != slog.LevelInfo {
		t.Fatal("empty")
	}
}
