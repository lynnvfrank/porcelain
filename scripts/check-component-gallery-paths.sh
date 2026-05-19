#!/usr/bin/env bash
# Verify docs/component-gallery/*.html link hrefs and script/img src paths.
# Fails when:
#   - href/src contains internal/server/embedui without adminui/embed/embedui
#   - a relative local asset path does not exist on disk
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GALLERY="${ROOT}/docs/component-gallery"
fail=0

is_skippable_url() {
	case "$1" in
	http://* | https://* | //* | mailto:* | javascript:* | data:*)
		return 0
		;;
	esac
	return 1
}

check_embedui_path() {
	local value="$1"
	local file="$2"
	if [[ "$value" == *internal/server/embedui* && "$value" != *adminui/embed/embedui* ]]; then
		echo "check-component-gallery-paths: obsolete embed path (use adminui/embed/embedui): $file" >&2
		echo "  -> $value" >&2
		fail=1
	fi
}

resolve_local_path() {
	local base_dir="$1"
	local ref="$2"
	local path="${ref%%#*}"
	path="${path%%\?*}"
	if [[ -z "$path" ]] || is_skippable_url "$path"; then
		return 1
	fi
	if [[ "$path" == /* ]]; then
		printf '%s\n' "$path"
		return 0
	fi
	local target
	target="$(cd "$base_dir" && realpath -m "$path" 2>/dev/null || true)"
	if [[ -z "$target" ]]; then
		return 1
	fi
	printf '%s\n' "$target"
}

for html in "$GALLERY"/*.html; do
	[[ -f "$html" ]] || continue
	base_dir="$(dirname "$html")"
	while IFS= read -r attr; do
		[[ -n "$attr" ]] || continue
		check_embedui_path "$attr" "$html"
		if resolved="$(resolve_local_path "$base_dir" "$attr" 2>/dev/null)"; then
			if [[ -n "$resolved" && ! -e "$resolved" ]]; then
				echo "check-component-gallery-paths: missing file: $html" >&2
				echo "  -> $attr (resolved: $resolved)" >&2
				fail=1
			fi
		fi
	done < <(grep -oE '(href|src)="[^"]+"' "$html" | sed -E 's/^(href|src)="([^"]+)"/\2/')
done

if [[ "$fail" -ne 0 ]]; then
	exit 1
fi

echo "check-component-gallery-paths: OK ($GALLERY)"
