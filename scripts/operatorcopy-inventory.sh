#!/usr/bin/env bash
# Scan Go emitters and logs UI JS for structured-log msg slugs; diff against operatorcopy registry.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
args=()
if [[ "${1:-}" == "-WriteReport" || "${1:-}" == "--write-report" ]]; then
  args+=(-write-report)
fi
exec go run ./internal/operatorcopy/cmd/inventory "${args[@]}"
