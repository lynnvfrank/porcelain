#!/usr/bin/env bash
# Remove llama.cpp runtime artifacts from a bin directory (Windows ships many DLLs).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-$REPO_ROOT/chimera/bin}"
[[ -d "$TARGET" ]] || exit 0

shopt -s nullglob
for pattern in \
	llama-server llama-server.exe \
	llama-*.exe llama-*.dll llama-*.so llama-*.so.* \
	ggml*.dll ggml*.so ggml*.so.* \
	libggml*.so libggml*.so.* libllama*.so libllama*.so.* libmtmd*.so libmtmd*.so.* \
	libomp*.dll; do
	for f in "$TARGET"/$pattern; do
		rm -f "$f"
	done
done
