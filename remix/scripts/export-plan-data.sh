#!/usr/bin/env bash
#
# Export meal plan + shopping list data from the Laravel SQLite database as
# slug-keyed SQL INSERTs, and apply them to the D1 database.
#
# Recipes themselves are NOT exported — R2 + POST /sync rebuilds the recipe
# index from the .md files, keeping the files the source of truth. Run this
# AFTER seed.sh so the recipe rows exist for the slug lookups.
#
# Usage:
#   ./scripts/export-plan-data.sh            # local dev D1
#   ./scripts/export-plan-data.sh --remote   # real D1, after account setup

set -euo pipefail

cd "$(dirname "$0")/.."

MODE="--local"
if [[ "${1:-}" == "--remote" ]]; then
  MODE="--remote"
fi

LARAVEL_DB="../database/database.sqlite"
OUT="$(mktemp -t meal-prep-plan-data)"

sqlite3 "$LARAVEL_DB" >"$OUT" <<'SQL'
.mode list
.separator ''
SELECT 'INSERT INTO meal_assignments (recipe_id, date, slot, batch_id, scale_factor, created_at, updated_at) '
    || 'SELECT r.id, ''' || date(ma.date) || ''', ''' || ma.slot || ''', ''' || ma.batch_id || ''', ' || ma.scale_factor
    || ', ''' || ma.created_at || ''', ''' || ma.updated_at || ''' FROM recipes r WHERE r.slug = ''' || re.slug || ''';'
FROM meal_assignments ma JOIN recipes re ON re.id = ma.recipe_id;

SELECT 'INSERT INTO shopping_lists (id, name, start_date, end_date, created_at, updated_at) VALUES ('
    || sl.id || ', ' || CASE WHEN sl.name IS NULL THEN 'NULL' ELSE '''' || replace(sl.name, '''', '''''') || '''' END
    || ', ''' || date(sl.start_date) || ''', ''' || date(sl.end_date) || ''', ''' || sl.created_at || ''', ''' || sl.updated_at || ''');'
FROM shopping_lists sl;

SELECT 'INSERT INTO shopping_list_items (shopping_list_id, name, quantity, unit, category, sources, checked_at, sort_order, created_at, updated_at) VALUES ('
    || si.shopping_list_id || ', ''' || replace(si.name, '''', '''''') || ''', '
    || CASE WHEN si.quantity IS NULL THEN 'NULL' ELSE si.quantity END || ', '
    || CASE WHEN si.unit IS NULL THEN 'NULL' ELSE '''' || si.unit || '''' END || ', '
    || '''' || si.category || ''', ''' || replace(si.sources, '''', '''''') || ''', '
    || CASE WHEN si.checked_at IS NULL THEN 'NULL' ELSE '''' || si.checked_at || '''' END || ', '
    || si.sort_order || ', ''' || si.created_at || ''', ''' || si.updated_at || ''');'
FROM shopping_list_items si;
SQL

echo "Applying $(wc -l <"$OUT" | tr -d ' ') statements to D1 ($MODE)..."
npx wrangler d1 execute meal-prep "$MODE" --file "$OUT"
rm -f "$OUT"
