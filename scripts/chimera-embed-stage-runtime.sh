#!/usr/bin/env bash
# Stage llama.cpp runtime bundle from chimera/.deps/llama.cpp/bin to a target directory.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$REPO_ROOT/bin}"
SRC="${LLAMA_RUNTIME_SRC:-$REPO_ROOT/chimera/.deps/llama.cpp/bin}"

if [[ ! -f "$SRC/llama-server" && ! -f "$SRC/llama-server.exe" ]]; then
	echo "chimera-embed-stage-runtime: missing llama-server under $SRC (run make chimera-embed-install)" >&2
	exit 1
fi

mkdir -p "$DEST"
cp -af "$SRC"/. "$DEST"/
if [[ -f "$DEST/llama-server" ]]; then
	chmod +x "$DEST/llama-server" 2>/dev/null || true
fi
echo "chimera-embed-stage-runtime: staged runtime -> $DEST"
