#!/usr/bin/env bash
# make desktop-build - builds the Porcelain launcher stack:
#   porcelain.exe -> chimera/bin/porcelain-desktop.exe -> chimera/bin/chimera.exe + Locus
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
# shellcheck source=scripts/msys2-gcc-path.sh
source "$root/scripts/msys2-gcc-path.sh"
msys2_prepend_gcc_path || true
bin="${1:?desktop-build.sh: missing output binary name (e.g. porcelain or porcelain.exe)}"
cd "$root"
export CGO_ENABLED=1

# Guardrail: keep launcher naming consistently Porcelain-branded.
case "$bin" in
  *claudia*|*chimera*)
    echo "desktop-build: error: output name must be Porcelain-branded (got '$bin')." >&2
    exit 2
    ;;
esac

target_os="${GOOS:-$(go env GOOS)}"
target_arch="${GOARCH:-$(go env GOARCH)}"
gui_ldflags=()
if [[ "$target_os" == "windows" ]]; then
  gui_ldflags=(-ldflags "-H=windowsgui")

  # Embed Explorer file icon for the outer Porcelain launcher.
  rc_file="$root/cmd/porcelain/icon_windows.rc"
  syso_file="$root/cmd/porcelain/icon_windows_${target_arch}.syso"
  if command -v windres >/dev/null 2>&1; then
    windres "$rc_file" -O coff -o "$syso_file"
  elif command -v x86_64-w64-mingw32-windres >/dev/null 2>&1; then
    x86_64-w64-mingw32-windres "$rc_file" -O coff -o "$syso_file"
  else
    echo "desktop-build: warning: windres not found; .exe will use default file icon in Explorer." >&2
  fi
fi

mkdir -p "$root/chimera/bin"

if ! go build -tags desktop "${gui_ldflags[@]}" -o "$root/chimera/bin/chimera.exe" ./cmd/claudia; then
  echo "" >&2
  echo "desktop-build: failed building chimera.exe; needs CGO and native WebView deps." >&2
  echo "  Run:  make desktop-install" >&2
  exit 1
fi

go build "${gui_ldflags[@]}" -o "$root/chimera/bin/porcelain-desktop.exe" ./cmd/porcelain-desktop
go build "${gui_ldflags[@]}" -o "$root/chimera/bin/$bin" ./cmd/porcelain
cp "$root/chimera/bin/$bin" "$root/$bin"

echo "Built $root/$bin and $root/chimera/bin/{porcelain.exe,porcelain-desktop.exe,chimera.exe}"
echo "Run: ./$bin or chimera/bin/$bin"
