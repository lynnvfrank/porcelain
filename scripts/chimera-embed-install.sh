#!/usr/bin/env bash
# Idempotent llama-server install path for chimera-embed wrapper flows.
# Verifies toolchain needed for fetch/unpack and installs llama-server from deps.lock.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
# shellcheck source=scripts/chimera-names.sh
source "$REPO_ROOT/scripts/chimera-names.sh"
# shellcheck source=scripts/install-toolchain-deps.sh
source "$REPO_ROOT/scripts/install-toolchain-deps.sh"
DEPS_DIR="${DEPS_DIR:-$REPO_ROOT/chimera/.deps}"
LLAMA_BIN_DIR="${LLAMA_BIN_DIR:-$REPO_ROOT/chimera/bin}"
LLAMA_DEPS_DIR="${LLAMA_DEPS_DIR:-$DEPS_DIR/llama.cpp}"

echo "==> chimera-embed-install: toolchain"
missing=0

toolchain_ensure_git || missing=1

if ! command -v curl >/dev/null 2>&1; then
	echo "    MISSING  curl is required to fetch llama.cpp releases" >&2
	missing=1
else
	echo "    OK  curl -> $(command -v curl)"
fi

if [ "$missing" -ne 0 ]; then
	echo "" >&2
	echo "chimera-embed-install: install missing tools, then re-run: make ${CHIMERA_MAKE_EMBED_INSTALL_TARGET}" >&2
	exit 1
fi

if [[ "${FORCE:-}" != "1" ]] && { [ -f "$LLAMA_BIN_DIR/llama-server.exe" ] || [ -f "$LLAMA_BIN_DIR/llama-server" ]; }; then
	if [ -f "$LLAMA_BIN_DIR/llama-server-impl.dll" ] || [ -f "$LLAMA_BIN_DIR/libllama.so" ] || [ -f "$LLAMA_BIN_DIR/llama-server" ]; then
		echo "==> chimera-embed-install: existing llama-server runtime detected ($LLAMA_BIN_DIR); skipping download"
		echo "    set FORCE=1 to refresh from deps.lock release pin"
	else
		echo "==> chimera-embed-install: incomplete llama-server runtime under $LLAMA_BIN_DIR; refreshing"
		bash "$REPO_ROOT/scripts/chimera-embed-clean-runtime.sh" "$LLAMA_BIN_DIR"
		export LLAMA_BIN_DIR LLAMA_DEPS_DIR
		bash "$REPO_ROOT/scripts/chimera-embed-llama-install.sh"
	fi
else
	echo "==> chimera-embed-install: llama-server (deps.lock)"
	export LLAMA_BIN_DIR LLAMA_DEPS_DIR
	bash "$REPO_ROOT/scripts/chimera-embed-llama-install.sh"
fi

mkdir -p "$LLAMA_DEPS_DIR/bin"

echo "==> chimera-embed-install: artifacts"
found=0
if [ -f "$LLAMA_BIN_DIR/llama-server.exe" ] || [ -f "$LLAMA_BIN_DIR/llama-server" ]; then
	echo "    OK  llama-server runtime under $LLAMA_BIN_DIR"
	found=1
fi
if [ "$found" -eq 0 ]; then
	echo "    WARN  no llama-server binary under $LLAMA_BIN_DIR -- check install output above" >&2
fi

echo ""
echo "chimera-embed-install: source checkout -> $LLAMA_DEPS_DIR"
echo "chimera-embed-install: deps cache -> $LLAMA_DEPS_DIR/bin"
echo "chimera-embed-install: done."
