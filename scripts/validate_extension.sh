#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST_PATH="$ROOT_DIR/manifest.json"
TMP_DIR="$(mktemp -d)"
TMP_ZIP="$TMP_DIR/extension-test.zip"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf '[PASS] %s\n' "$1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf '[FAIL] %s\n' "$1"
}

require_cmd() {
  if command -v "$1" >/dev/null 2>&1; then
    pass "Command available: $1"
  else
    fail "Missing required command: $1"
  fi
}

check_file() {
  local path="$1"
  local label="$2"
  if [ -f "$path" ]; then
    pass "$label exists: ${path#$ROOT_DIR/}"
  else
    fail "$label missing: ${path#$ROOT_DIR/}"
  fi
}

echo "Running local extension validation in: $ROOT_DIR"

require_cmd jq
require_cmd zip
require_cmd unzip

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo "Stopping early due to missing tooling."
  exit 1
fi

check_file "$MANIFEST_PATH" "Manifest"

if jq empty "$MANIFEST_PATH" >/dev/null 2>&1; then
  pass "manifest.json is valid JSON"
else
  fail "manifest.json is not valid JSON"
fi

if jq -e '.manifest_version == 3' "$MANIFEST_PATH" >/dev/null; then
  pass "manifest_version is 3"
else
  fail "manifest_version must be 3"
fi

for field in name version description; do
  if jq -e --arg f "$field" '.[$f] | type == "string" and length > 0' "$MANIFEST_PATH" >/dev/null; then
    pass "manifest.$field is a non-empty string"
  else
    fail "manifest.$field is missing or empty"
  fi
done

SERVICE_WORKER="$(jq -r '.background.service_worker // empty' "$MANIFEST_PATH")"
if [ -n "$SERVICE_WORKER" ]; then
  check_file "$ROOT_DIR/$SERVICE_WORKER" "Background service worker"
else
  fail "background.service_worker is missing"
fi

POPUP_FILE="$(jq -r '.action.default_popup // empty' "$MANIFEST_PATH")"
if [ -n "$POPUP_FILE" ]; then
  check_file "$ROOT_DIR/$POPUP_FILE" "Popup file"
else
  fail "action.default_popup is missing"
fi

if jq -e '.host_permissions | type == "array" and length > 0' "$MANIFEST_PATH" >/dev/null; then
  pass "host_permissions is a non-empty array"
else
  fail "host_permissions must be a non-empty array"
fi

if jq -e '.host_permissions[] | test("^\\*://")' "$MANIFEST_PATH" >/dev/null; then
  pass "host_permissions entries use URL match pattern format"
else
  fail "One or more host_permissions entries do not start with *://"
fi

if [ -f "$ROOT_DIR/popup.html" ]; then
  if grep -q 'popup.js' "$ROOT_DIR/popup.html"; then
    pass "popup.html references popup.js"
  else
    fail "popup.html does not reference popup.js"
  fi
fi

# Smoke-test packaging without polluting the repo.
(
  cd "$ROOT_DIR"
  git archive --format=zip --output "$TMP_ZIP" HEAD
)
pass "git archive can build a clean zip from HEAD"

FOUND_MANIFEST=0
while IFS= read -r entry; do
  entry="${entry%$'\r'}"
  if [ "$entry" = "manifest.json" ]; then
    FOUND_MANIFEST=1
    break
  fi
done < <(unzip -Z1 "$TMP_ZIP")

if [ "$FOUND_MANIFEST" -eq 1 ]; then
  pass "Packaged zip includes manifest.json at archive root"
else
  fail "Packaged zip is missing manifest.json at archive root"
fi

echo
echo "Validation result: $PASS_COUNT passed, $FAIL_COUNT failed."

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi

echo "Extension package is structurally ready for manual testing/publishing."
