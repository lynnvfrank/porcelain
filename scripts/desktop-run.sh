#!/usr/bin/env bash
# make desktop-run â€” ensure porcelain exists, then exec with remaining args (e.g. desktop -qdrant-bin â€¦).
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
bin="${1:?desktop-run.sh: missing binary name (e.g. porcelain.exe)}"
make_cmd="${2:-make}"
shift 2 || true
cd "$root"
if [[ ! -f "$bin" ]]; then
  "$make_cmd" desktop-build
fi
exec "$root/$bin" "$@"

