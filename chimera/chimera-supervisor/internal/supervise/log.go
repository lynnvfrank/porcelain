package supervise

import (
	"io"
	"log/slog"
	"os"

	gwconfig "github.com/lynn/porcelain/chimera/internal/config"
	"github.com/lynn/porcelain/chimera/internal/logfmt"
	wline "github.com/lynn/porcelain/chimera/internal/wrapper/line"
)

// LogSink normalizes child stdout/stderr to JSON lines, applies minLevel, and records
// them in the ring buffer and process stdout.
func LogSink(storeWriter io.Writer, normalize func(io.Writer) io.Writer, minLevel slog.Level) io.Writer {
	sink := io.MultiWriter(
		wline.NewLevelFilterWriter(storeWriter, minLevel),
		wline.NewLevelFilterWriter(os.Stdout, minLevel),
	)
	return normalize(sink)
}

func resolveLogLevel(gatewayPath string) slog.Level {
	if e := os.Getenv("LOG_LEVEL"); e != "" {
		return wline.ParseLogLevel(e)
	}
	res, err := gwconfig.LoadGatewayYAML(gatewayPath, nil)
	if err == nil {
		return wline.ParseLogLevel(res.LogLevel)
	}
	return slog.LevelInfo
}

func buildLogger(w io.Writer, level slog.Level, json bool) *slog.Logger {
	return logfmt.NewLogger(w, json, level)
}
