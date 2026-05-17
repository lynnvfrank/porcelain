#!/usr/bin/env bash
# Per-product clean helpers (see Makefile chimera-*-clean* / locus-*-clean*).
# Usage: clean-product.sh <product> <mode>
#   product: gateway | supervisor | broker | vectorstore | indexer | desktop
#   mode:    build | install | configure | run | all
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
# shellcheck source=scripts/chimera-names.sh
source "$ROOT/scripts/chimera-names.sh"

PRODUCT="${1:-}"
MODE="${2:-all}"
if [[ -z "$PRODUCT" || -z "$MODE" ]]; then
	echo "usage: clean-product.sh <product> <mode>" >&2
	echo "  product: gateway | supervisor | broker | vectorstore | indexer | desktop" >&2
	echo "  mode:    build | install | configure | run | all" >&2
	exit 1
fi

want() {
	case "$MODE" in
	all) return 0 ;;
	"$1") return 0 ;;
	*) return 1 ;;
	esac
}

rm_paths() {
	local p removed=0
	for p in "$@"; do
		[[ -e "$p" || -L "$p" ]] || continue
		rm -rf "$p"
		removed=1
	done
	if [[ "$removed" -eq 1 ]]; then
		echo "clean-${PRODUCT}-${MODE}: removed $*"
	fi
}

case "$PRODUCT" in
gateway)
	if want build; then
		rm_paths \
			"chimera/bin/${CHIMERA_GATEWAY_BIN_BASE}" "chimera/bin/${CHIMERA_GATEWAY_BIN_BASE}.exe" \
			"bin/${CHIMERA_GATEWAY_BIN_BASE}" "bin/${CHIMERA_GATEWAY_BIN_BASE}.exe"
	fi
	if want install; then
		go clean -i ./chimera/chimera-gateway 2>/dev/null || true
		echo "clean-${PRODUCT}-${MODE}: go clean -i ./chimera/chimera-gateway"
	fi
	if want configure; then
		rm_paths "config/gateway.yaml"
	fi
	if want run; then
		rm_paths "data/gateway"
	fi
	;;
supervisor)
	if want build; then
		rm_paths \
			"chimera/bin/${CHIMERA_SUPERVISOR_BIN_BASE}" "chimera/bin/${CHIMERA_SUPERVISOR_BIN_BASE}.exe" \
			"bin/${CHIMERA_SUPERVISOR_BIN_BASE}" "bin/${CHIMERA_SUPERVISOR_BIN_BASE}.exe"
	fi
	if want install; then
		: # supervisor has no separate install target yet
	fi
	if want configure; then
		: # no generated supervisor config
	fi
	if want run; then
		rm_paths \
			"$(chimera_pid_path)" \
			"$(chimera_log_path)" \
			"chimera/run" \
			"run" \
			"logs"
	fi
	;;
broker)
	if want build; then
		rm_paths \
			"chimera/bin/${CHIMERA_BROKER_BIN_BASE}" "chimera/bin/${CHIMERA_BROKER_BIN_BASE}.exe" \
			"bin/${CHIMERA_BROKER_BIN_BASE}" "bin/${CHIMERA_BROKER_BIN_BASE}.exe" \
			"bin/bifrost-http" "bin/bifrost-http.exe"
	fi
	if want install; then
		rm_paths \
			"chimera/bin/bifrost-http" "chimera/bin/bifrost-http.exe" \
			"bin/bifrost-http" "bin/bifrost-http.exe" \
			"chimera/.deps/bifrost" \
			".deps/bifrost"
	fi
	if want configure; then
		rm_paths "config/chimera-broker.config.json"
	fi
	if want run; then
		rm_paths "data/bifrost"
	fi
	;;
vectorstore)
	if want build; then
		rm_paths \
			"chimera/bin/${CHIMERA_VECTORSTORE_BIN_BASE}" "chimera/bin/${CHIMERA_VECTORSTORE_BIN_BASE}.exe" \
			"bin/${CHIMERA_VECTORSTORE_BIN_BASE}" "bin/${CHIMERA_VECTORSTORE_BIN_BASE}.exe" \
			"bin/qdrant" "bin/qdrant.exe"
	fi
	if want install; then
		rm_paths \
			"chimera/bin/qdrant" "chimera/bin/qdrant.exe" \
			"bin/qdrant" "bin/qdrant.exe" \
			"chimera/.deps/qdrant" \
			".deps/qdrant"
	fi
	if want configure; then
		rm_paths "config/qdrant.config.yaml"
	fi
	if want run; then
		rm_paths "data/qdrant"
	fi
	;;
indexer)
	if want build; then
		rm_paths \
			"chimera/bin/${CHIMERA_INDEX_BIN_BASE}" "chimera/bin/${CHIMERA_INDEX_BIN_BASE}.exe" \
			"bin/${CHIMERA_INDEX_BIN_BASE}" "bin/${CHIMERA_INDEX_BIN_BASE}.exe"
	fi
	if want install; then
		go clean -i ./chimera/chimera-indexer 2>/dev/null || true
		echo "clean-${PRODUCT}-${MODE}: go clean -i ./chimera/chimera-indexer"
	fi
	if want configure; then
		rm_paths "config/indexer.yaml"
	fi
	if want run; then
		rm_paths \
			"data/gateway/indexer.supervised.yaml" \
			"data/gateway/indexer.sync-state.json"
	fi
	;;
desktop)
	if want build; then
		rm_paths \
			"locus/bin/${LOCUS_DESKTOP_BIN_BASE}" "locus/bin/${LOCUS_DESKTOP_BIN_BASE}.exe" \
			"bin/${LOCUS_DESKTOP_BIN_BASE}" "bin/${LOCUS_DESKTOP_BIN_BASE}.exe"
	fi
	if want install; then
		: # OS packages from locus-desktop-install are not removed here
	fi
	if want configure; then
		: # no generated locus desktop config at repo root
	fi
	if want run; then
		rm_paths "locus/run"
	fi
	;;
*)
	echo "clean-product: unknown product: $PRODUCT" >&2
	exit 1
	;;
esac
