#!/usr/bin/env bash
# Publish (or replace) the ScreenParser ONNX on a GitHub Release.
# Usage:
#   ./scripts/publish-model-release.sh
#   MODEL_RELEASE_TAG=model-v2 ./scripts/publish-model-release.sh path/to/screenparser.onnx
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAG="${MODEL_RELEASE_TAG:-model-v1}"
ASSET="${1:-$ROOT/public/models/screenparser.onnx}"

if [[ ! -f "$ASSET" ]]; then
  echo "Model file not found: $ASSET" >&2
  echo "Run: python scripts/export_onnx.py  (then move the .onnx here)" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required." >&2
  exit 1
fi

if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Updating asset on existing release $TAG…"
  gh release upload "$TAG" "$ASSET" --clobber
else
  echo "Creating release $TAG…"
  gh release create "$TAG" "$ASSET" \
    --title "ScreenParser model" \
    --notes "ONNX weights for ScreenDesc section detection. Consumed at build time by GitHub Actions; not fetched by the browser."
fi

echo "Done. CI downloads this via: MODEL_RELEASE_TAG=$TAG npm run fetch-model"
