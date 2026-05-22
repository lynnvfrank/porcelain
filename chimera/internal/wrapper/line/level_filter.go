package line

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"strings"
	"sync"
)

// ParseLogLevel maps config/env log level strings to slog.Level (default INFO).
func ParseLogLevel(v string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "trace":
		return slog.Level(-8)
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// LineMeetsMinLevel reports whether a normalized log line should be emitted at min.
// Unparseable or level-less lines are treated as INFO.
func LineMeetsMinLevel(line string, min slog.Level) bool {
	return levelFromLine(line) >= min
}

func levelFromLine(line string) slog.Level {
	line = strings.TrimSpace(line)
	if line == "" {
		return slog.LevelInfo
	}
	if line[0] != '{' {
		return slog.LevelInfo
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal([]byte(line), &fields); err != nil {
		return slog.LevelInfo
	}
	raw, ok := fields["level"]
	if !ok {
		return slog.LevelInfo
	}
	var n int
	if json.Unmarshal(raw, &n) == nil {
		return slog.Level(n)
	}
	s := strings.TrimSpace(JSONString(fields, "level"))
	if s == "" {
		return slog.LevelInfo
	}
	return ParseLogLevel(s)
}

// NewLevelFilterWriter drops complete lines below min before forwarding to dst.
func NewLevelFilterWriter(dst io.Writer, min slog.Level) io.Writer {
	if dst == nil {
		return nil
	}
	return &levelFilterWriter{dst: dst, min: min}
}

type levelFilterWriter struct {
	dst io.Writer
	min slog.Level
	buf []byte
	mu  sync.Mutex
}

func (w *levelFilterWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	w.buf = append(w.buf, p...)
	for {
		i := bytes.IndexByte(w.buf, '\n')
		if i < 0 {
			break
		}
		line := string(w.buf[:i])
		w.buf = w.buf[i+1:]
		if !LineMeetsMinLevel(line, w.min) {
			continue
		}
		if _, err := w.dst.Write([]byte(line)); err != nil {
			return len(p), err
		}
		if _, err := w.dst.Write([]byte{'\n'}); err != nil {
			return len(p), err
		}
	}
	const maxFrag = 64 << 10
	if gap := len(w.buf) - maxFrag; gap > 0 {
		w.buf = w.buf[gap:]
	}
	return len(p), nil
}
