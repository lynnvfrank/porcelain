package platform

import "log/slog"

// LevelTrace is one step below slog.LevelDebug (-4). Use for very chatty
// per-operation traces that are too noisy for DEBUG.
const LevelTrace slog.Level = -8
