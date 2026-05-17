#!/usr/bin/env bash
# Fail if gofmt would change any file under the given dirs (default: chimera locus).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
dirs=("$@")
if [[ ${#dirs[@]} -eq 0 ]]; then
	dirs=(chimera locus)
fi
bad="$(gofmt -l "${dirs[@]}" || true)"
if [[ -n "$bad" ]]; then
	echo 'gofmt: run "make fmt" to fix formatting in:' >&2
	echo "$bad" >&2
	exit 1
fi
