#!/usr/bin/env bash
# Install pinned llama-server runtime from llama.cpp GitHub releases.
# Version: LLAMA_CPP_RELEASE in chimera/deps.lock.
# Also checks out matching source under LLAMA_DEPS_DIR for local reference.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=deps-lock.sh
source "$REPO_ROOT/scripts/deps-lock.sh"
VER="$(deps_lock_get LLAMA_CPP_RELEASE)"
GIT_URL="$(deps_lock_get LLAMA_CPP_GIT_URL)"
ROOT="$REPO_ROOT"
LLAMA_BIN_DIR="${LLAMA_BIN_DIR:-$ROOT/chimera/bin}"
LLAMA_DEPS_DIR="${LLAMA_DEPS_DIR:-$ROOT/chimera/.deps/llama.cpp}"
LLAMA_RUNTIME_DIR="${LLAMA_RUNTIME_DIR:-$LLAMA_DEPS_DIR/bin}"
BASE="https://github.com/ggml-org/llama.cpp/releases/download/${VER}"
mkdir -p "$LLAMA_BIN_DIR" "$LLAMA_RUNTIME_DIR"

_find_llama_runtime_root() {
	local dir="$1"
	if [[ -f "$dir/llama-server" || -f "$dir/llama-server.exe" ]]; then
		printf '%s\n' "$dir"
		return 0
	fi
	local sub
	for sub in "$dir"/*; do
		if [[ -d "$sub" ]] && { [[ -f "$sub/llama-server" ]] || [[ -f "$sub/llama-server.exe" ]]; }; then
			printf '%s\n' "$sub"
			return 0
		fi
	done
	return 1
}

_sync_llama_runtime() {
	local src="$1"
	local dst="$2"
	mkdir -p "$dst"
	# Windows releases ship llama-server.exe stubs plus companion DLLs in the same directory.
	cp -af "$src"/. "$dst"/
	if [[ -f "$dst/llama-server" ]]; then
		chmod +x "$dst/llama-server" 2>/dev/null || true
	fi
}

_install_runtime_from_root() {
	local runtime_root="$1"
	_sync_llama_runtime "$runtime_root" "$LLAMA_RUNTIME_DIR"
	_sync_llama_runtime "$runtime_root" "$LLAMA_BIN_DIR"
	if [[ -f "$LLAMA_BIN_DIR/llama-server.exe" ]]; then
		echo "Installed $LLAMA_BIN_DIR/llama-server.exe ($VER)"
	elif [[ -f "$LLAMA_BIN_DIR/llama-server" ]]; then
		echo "Installed $LLAMA_BIN_DIR/llama-server ($VER)"
	else
		echo "chimera-embed-llama-install: llama-server missing after install" >&2
		return 1
	fi
}

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"
case "$os" in
mingw*|msys*|cygwin*)
	case "$arch" in
	x86_64) asset="llama-${VER}-bin-win-cpu-x64.zip" ;;
	aarch64 | arm64) asset="llama-${VER}-bin-win-cpu-arm64.zip" ;;
	*)
		echo "chimera-embed-llama-install: unsupported Windows arch: $arch (see ${BASE})" >&2
		exit 1
		;;
	esac
	command -v unzip >/dev/null 2>&1 || {
		echo "chimera-embed-llama-install: unzip is required for the Windows llama.cpp zip." >&2
		exit 1
	}
	tmp="$(mktemp -d)"
	curl -fsSL "${BASE}/${asset}" -o "$tmp/llama.zip"
	unzip -q "$tmp/llama.zip" -d "$tmp/extract"
	runtime_root="$(_find_llama_runtime_root "$tmp/extract")" || {
		echo "chimera-embed-llama-install: expected llama-server in ${asset}" >&2
		rm -rf "$tmp"
		exit 1
	}
	_install_runtime_from_root "$runtime_root"
	rm -rf "$tmp"
	;;
linux)
	case "$arch" in
	x86_64) asset="llama-${VER}-bin-ubuntu-x64.tar.gz" ;;
	aarch64 | arm64) asset="llama-${VER}-bin-ubuntu-arm64.tar.gz" ;;
	*)
		echo "chimera-embed-llama-install: unsupported Linux arch: $arch" >&2
		exit 1
		;;
	esac
	tmp="$(mktemp -d)"
	curl -fsSL "${BASE}/${asset}" | tar xz -C "$tmp" || true
	runtime_root="$(_find_llama_runtime_root "$tmp")" || {
		echo "chimera-embed-llama-install: expected llama-server in ${asset}" >&2
		rm -rf "$tmp"
		exit 1
	}
	_install_runtime_from_root "$runtime_root"
	rm -rf "$tmp"
	;;
darwin)
	case "$arch" in
	x86_64) asset="llama-${VER}-bin-macos-x64.tar.gz" ;;
	arm64) asset="llama-${VER}-bin-macos-arm64.tar.gz" ;;
	*)
		echo "chimera-embed-llama-install: unsupported macOS arch: $arch" >&2
		exit 1
		;;
	esac
	tmp="$(mktemp -d)"
	curl -fsSL "${BASE}/${asset}" | tar xz -C "$tmp" || true
	runtime_root="$(_find_llama_runtime_root "$tmp")" || {
		echo "chimera-embed-llama-install: expected llama-server in ${asset}" >&2
		rm -rf "$tmp"
		exit 1
	}
	_install_runtime_from_root "$runtime_root"
	rm -rf "$tmp"
	;;
*)
	echo "chimera-embed-llama-install: unsupported OS/kernel: $(uname -s) (try Git Bash on Windows, WSL, Linux, or macOS; or download manually from ${BASE})" >&2
	exit 1
	;;
esac

mkdir -p "$(dirname "$LLAMA_DEPS_DIR")"
if [[ ! -d "$LLAMA_DEPS_DIR/.git" ]]; then
	echo "chimera-embed-llama-install: cloning llama.cpp source -> $LLAMA_DEPS_DIR"
	git clone --depth 1 --branch "$VER" "$GIT_URL" "$LLAMA_DEPS_DIR"
else
	echo "chimera-embed-llama-install: updating llama.cpp source at $LLAMA_DEPS_DIR"
	git -C "$LLAMA_DEPS_DIR" fetch --tags origin
	git -C "$LLAMA_DEPS_DIR" checkout -f "$VER"
fi
