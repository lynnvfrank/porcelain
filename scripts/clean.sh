#!/usr/bin/env bash
# Remove local build artifacts for all products (see Makefile clean).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

for product in gateway supervisor broker vectorstore indexer desktop; do
	bash "$ROOT/scripts/clean-product.sh" "$product" build
done
rm -rf dist
echo "clean: removed product build outputs under chimera/bin/, locus/bin/, bin/, and dist/"
