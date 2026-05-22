package supervise

import (
	"io"
	"log/slog"
	"strings"
	"testing"

	"github.com/lynn/porcelain/chimera/internal/servicelogs"
)

func passthroughWriter(w io.Writer) io.Writer { return w }

func TestLogSink_filtersDebugAtInfo(t *testing.T) {
	store := servicelogs.New(100)
	sink := LogSink(store.Writer(servicelogs.SourceChimeraVectorstore), passthroughWriter, slog.LevelInfo)

	raw := `{"timestamp":"t","level":"DEBUG","service":"chimera-vectorstore","msg":"vectorstore.http.access_other","http_status":200,"_chimera_norm":1}` + "\n" +
		`{"timestamp":"t","level":"INFO","service":"chimera-vectorstore","msg":"vectorstore.ready","_chimera_norm":1}` + "\n"
	if _, err := sink.Write([]byte(raw)); err != nil {
		t.Fatal(err)
	}
	entries := store.Snapshot()
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry after INFO filter, got %d: %+v", len(entries), entries)
	}
	if !strings.Contains(entries[0].Text, "vectorstore.ready") {
		t.Fatalf("unexpected kept line: %q", entries[0].Text)
	}
}

func TestLogSink_keepsDebugAtDebug(t *testing.T) {
	store := servicelogs.New(100)
	sink := LogSink(store.Writer(servicelogs.SourceChimeraVectorstore), passthroughWriter, slog.LevelDebug)

	line := `{"timestamp":"t","level":"DEBUG","service":"chimera-vectorstore","msg":"vectorstore.http.access_other","_chimera_norm":1}` + "\n"
	if _, err := sink.Write([]byte(line)); err != nil {
		t.Fatal(err)
	}
	if len(store.Snapshot()) != 1 {
		t.Fatal("expected DEBUG line in store at debug level")
	}
}
