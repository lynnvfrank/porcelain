#!/usr/bin/env bash
# Fail when chimera-gateway logs conversation.* slugs as raw string literals (use naming.Msg*).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

violations=0
while IFS= read -r -d '' f; do
  case "$f" in
    *_test.go) continue ;;
  esac
  if grep -nE '"msg"[[:space:]]*,[[:space:]]*"conversation\.' "$f" >/dev/null 2>&1; then
    echo "operatorcopy-msg-audit: raw conversation msg literal in $f"
    grep -nE '"msg"[[:space:]]*,[[:space:]]*"conversation\.' "$f" | head -20
    violations=1
  fi
done < <(find chimera/chimera-gateway/internal -name '*.go' -print0)

if [[ "$violations" -ne 0 ]]; then
  echo "operatorcopy-msg-audit: use naming.Msg* from internal/naming/log_messages.go"
  exit 1
fi

echo "operatorcopy-msg-audit: OK (no raw conversation.* msg literals)"
