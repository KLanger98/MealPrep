# Meal Prep App

Laravel 13 + Inertia/Vue 3 + SQLite. Recipes are Markdown files with YAML
frontmatter in `recipes/` — the files are the source of truth; the database
only indexes them (synced automatically on page load, or via
`php artisan recipes:sync -v`).

## Creating recipes

When asked to create or edit a recipe, follow `recipes/SCHEMA.md` exactly and
save the file as `recipes/<slug>.md`. Key rules: `title` and `ingredients` are
required; keep ingredient names consistent across recipes (shopping lists
merge by exact name); prefer grams over cups; omit `quantity` for "to taste"
items.

## Development

- `composer run dev` (or `php artisan serve` + `npm run dev`) — Node 22 via nvm required for Vite.
- `php artisan test` — run before committing.
- Meal slots are configured in `config/mealplan.php`; recipes path in `config/recipes.php` (`RECIPES_PATH` env).
