#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
OUTPUT_ZIP="${1:-$DIST_DIR/ai-footprint-timer-chrome.zip}"
TMP_DIR="$(mktemp -d)"
TMP_ZIP="$TMP_DIR/package.zip"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

mkdir -p "$DIST_DIR"

(
  cd "$ROOT_DIR"
  git archive --format=zip --output "$TMP_ZIP" HEAD
)

# Validate packaged shape before publishing.
if ! unzip -Z1 "$TMP_ZIP" | awk '{ sub(/\r$/, "", $0); if ($0 == "manifest.json") found=1 } END { exit(found?0:1) }'; then
  echo "Error: packaged zip does not include manifest.json at archive root." >&2
  exit 1
fi

mv "$TMP_ZIP" "$OUTPUT_ZIP"

echo "Publish ZIP created: $OUTPUT_ZIP"
echo "Tip: upload this ZIP in Chrome Web Store Developer Dashboard."
