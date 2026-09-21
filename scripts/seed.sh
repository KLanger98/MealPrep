#!/usr/bin/env bash
#
# Seed the app from the repo's recipes/ folder: photos go into the R2 bucket,
# then each .md is imported into D1 through POST /recipes/import.
#
# Usage:
#   ./scripts/seed.sh                     # local dev (Miniflare state)
#   APP_URL=http://localhost:5173 ./scripts/seed.sh
#
# The dev server must be running (npm run dev). Recipes whose slug already
# exists are reported and skipped. Production recipes are created in the app
# or by the recipe clipper, not seeded.

set -euo pipefail

cd "$(dirname "$0")/.."

RECIPES_DIR="./recipes"
BUCKET="meal-prep-recipes"
APP_URL="${APP_URL:-http://localhost:5173}"

shopt -s nullglob
for f in "$RECIPES_DIR"/*.jpg "$RECIPES_DIR"/*.jpeg "$RECIPES_DIR"/*.png "$RECIPES_DIR"/*.webp "$RECIPES_DIR"/*.gif; do
  name="$(basename "$f")"
  echo "put recipes/$name"
  npx wrangler r2 object put "$BUCKET/recipes/$name" --file "$f" --local >/dev/null
done

for f in "$RECIPES_DIR"/*.md; do
  name="$(basename "$f")"
  if [[ "$name" == "SCHEMA.md" || "$name" == "README.md" ]]; then
    continue
  fi
  echo "import $name"
  curl -s -X POST "$APP_URL/recipes/import" -H "Content-Type: text/markdown" --data-binary "@$f" && echo
done
