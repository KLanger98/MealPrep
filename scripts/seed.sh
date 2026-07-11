#!/usr/bin/env bash
#
# Upload the repo's recipes/ folder (markdown + photos) into the R2 bucket
# and trigger a full resync so D1 indexes them.
#
# Usage:
#   ./scripts/seed.sh                     # local dev (Miniflare state)
#   ./scripts/seed.sh --remote            # real bucket, after account setup
#   SYNC_URL=http://localhost:5173 ./scripts/seed.sh
#
# For local seeding the dev server must be running (npm run dev) so the
# final sync request can hit POST /sync.

set -euo pipefail

cd "$(dirname "$0")/.."

MODE="--local"
if [[ "${1:-}" == "--remote" ]]; then
  MODE="--remote"
fi

RECIPES_DIR="./recipes"
BUCKET="meal-prep-recipes"
SYNC_URL="${SYNC_URL:-http://localhost:5173}"

shopt -s nullglob
for f in "$RECIPES_DIR"/*.md "$RECIPES_DIR"/*.jpg "$RECIPES_DIR"/*.jpeg "$RECIPES_DIR"/*.png "$RECIPES_DIR"/*.webp "$RECIPES_DIR"/*.gif; do
  name="$(basename "$f")"
  if [[ "$name" == "SCHEMA.md" || "$name" == "README.md" ]]; then
    continue
  fi
  echo "put recipes/$name"
  npx wrangler r2 object put "$BUCKET/recipes/$name" --file "$f" "$MODE" >/dev/null
done

if [[ "$MODE" == "--local" ]]; then
  echo "Triggering sync at $SYNC_URL/sync ..."
  curl -sf -X POST "$SYNC_URL/sync" && echo
else
  echo "Remote objects uploaded. Hit POST /sync on the deployed app to index them."
fi
