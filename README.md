# Meal Prep

A personal meal-prep manager. Recipes are portable Markdown files; the app
indexes them into SQLite so you can browse a library, plan meals on a weekly
calendar (one batch of cooking can cover several days), and generate a
merged shopping list for any date range.

Built with Laravel, Inertia.js + Vue 3, Tailwind CSS, and SQLite.

## The core idea: recipes are files

Every recipe is a single `.md` file in `recipes/` — YAML frontmatter for the
structured data (type, protein, cost, servings, ingredients), Markdown for
the method. The files are the source of truth: the database only caches them
and re-syncs automatically whenever you load a page (or run
`php artisan recipes:sync -v`). Delete the database and nothing is lost
except calendar plans and shopping lists.

### Adding a recipe with AI (the low-friction workflow)

Tell any AI assistant:

> Read `recipes/SCHEMA.md`, then create a recipe file in `recipes/` for
> [the recipe you want — a URL, a photo of a cookbook page, a description].

Refresh the browser and the recipe is in your library. Files with broken
frontmatter never crash the app — they're skipped and listed in a banner.

The full format contract lives in [recipes/SCHEMA.md](recipes/SCHEMA.md).
Rules that matter most:

- Keep ingredient **names consistent across recipes** — shopping lists merge
  by exact name ("spring onions" and "scallions" won't combine).
- Prefer weight (`g`) over volume. `g`/`kg` and `ml`/`l` merge automatically;
  other unit mismatches show as separate lines.
- Omit `quantity` for "to taste" items; they appear once, unscaled.

## Daily use

- **Recipes** — browse, filter by type/protein/cost/tag, search titles and
  ingredients. The detail page can scale quantities for display (e.g. view at
  2×) without changing anything.
- **Calendar** — assign a recipe to a meal slot (breakfast/lunch/dinner)
  across one or more days. A multi-day assignment is one *batch*: one cook,
  eaten across those days. Set a scale factor per batch (e.g. 1.5× to get 6
  servings from a 4-serving recipe). Edit or remove single days or the whole
  batch. Slots are configured in `config/mealplan.php`.
- **Shopping lists** — pick a date range; the app collects every batch that
  overlaps it (each counted once, scaled), merges duplicate ingredients, and
  groups them by aisle. Tick off what you already have — ticks survive
  regeneration after calendar changes.

## Development

Requires PHP 8.4+, Composer, and Node 20+ (`nvm use 22`).

```bash
composer install && npm install
cp .env.example .env && php artisan key:generate
php artisan migrate
composer run dev   # serves the app + Vite dev server
```

`php artisan test` runs the suite. The recipes folder location is
configurable via `RECIPES_PATH` in `.env` if you want to keep your recipe
files somewhere else (e.g. a synced notes folder).
