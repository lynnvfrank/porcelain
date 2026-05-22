#!/usr/bin/env bash
# Verify settings gallery HTML link hrefs and script/img src paths.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GALLERY_HTML="${ROOT}/chimera/chimera-gateway/internal/server/adminui/embed/embedui/settings/gallery.html"
EMBED_UI="${ROOT}/chimera/chimera-gateway/internal/server/adminui/embed/embedui"
fail=0

is_skippable_url() {
	case "$1" in
	http://* | https://* | //* | mailto:* | javascript:* | data:*)
		return 0
		;;
	esac
	return 1
}

check_forbidden_gallery_ref() {
	local value="$1"
	local file="$2"
	case "$value" in
	*reload.svg* | *sample.html*)
		echo "check-component-gallery-paths: forbidden gallery path: $file" >&2
		echo "  -> $value" >&2
		fail=1
		;;
	/ui/gallery | /ui/gallery/*)
		echo "check-component-gallery-paths: forbidden legacy gallery route: $file" >&2
		echo "  -> $value" >&2
		fail=1
		;;
	*/ui/assets/settings/gallery*)
		echo "check-component-gallery-paths: use /ui/assets/gallery/: $file" >&2
		echo "  -> $value" >&2
		fail=1
		;;
	esac
}

check_embedui_path() {
	local value="$1"
	local file="$2"
	if [[ "$value" == *internal/server/embedui* && "$value" != *adminui/embed/embedui* ]]; then
		echo "check-component-gallery-paths: obsolete embed path (use /ui/assets/): $file" >&2
		echo "  -> $value" >&2
		fail=1
	fi
	if [[ "$value" == *chimera/chimera-gateway*embed/embedui* || "$value" == *../../chimera/* ]]; then
		echo "check-component-gallery-paths: use /ui/assets/ paths, not repo-relative embed paths: $file" >&2
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
	if [[ "$path" == /ui/settings* || "$path" == /ui/assets/settings* ]]; then
		return 1
	fi
	if [[ "$path" == /ui/assets/* ]]; then
		local rel="${path#/ui/assets/}"
		printf '%s\n' "${EMBED_UI}/${rel}"
		return 0
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

if [[ ! -f "$GALLERY_HTML" ]]; then
	echo "check-component-gallery-paths: missing $GALLERY_HTML" >&2
	exit 1
fi

base_dir="$(dirname "$GALLERY_HTML")"
while IFS= read -r attr; do
	[[ -n "$attr" ]] || continue
	check_forbidden_gallery_ref "$attr" "$GALLERY_HTML"
	check_embedui_path "$attr" "$GALLERY_HTML"
	if resolved="$(resolve_local_path "$base_dir" "$attr" 2>/dev/null)"; then
		if [[ -n "$resolved" && ! -e "$resolved" ]]; then
			echo "check-component-gallery-paths: missing file: $GALLERY_HTML" >&2
			echo "  -> $attr (resolved: $resolved)" >&2
			fail=1
		fi
	fi
done < <(grep -oE '(href|src)="[^"]+"' "$GALLERY_HTML" | sed -E 's/^(href|src)="([^"]+)"/\2/')

if [[ "$fail" -ne 0 ]]; then
	exit 1
fi

echo "check-component-gallery-paths: OK ($GALLERY_HTML)"
