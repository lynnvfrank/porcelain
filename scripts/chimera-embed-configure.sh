#!/usr/bin/env bash
# Prepare data/embedding layout for chimera-embed + internal embedding provider.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=scripts/chimera-names.sh
source "$ROOT/scripts/chimera-names.sh"

EMBED_DATA="${CHIMERA_EMBED_DATA_DIR:-$ROOT/data/embedding}"
MODELS_DIR="$EMBED_DATA/models"
CACHE_DIR="$EMBED_DATA/cache"

mkdir -p "$MODELS_DIR" "$CACHE_DIR"

echo "chimera-embed-configure: data dirs"
echo "    OK  $MODELS_DIR"
echo "    OK  $CACHE_DIR"
echo "chimera-embed-configure: place GGUF weights at data/embedding/models/nomic-embed-text.gguf"
echo "chimera-embed-configure: enable internal_embedding in config/gateway.yaml when ready (see config/internal-embedding.example.yaml)"
