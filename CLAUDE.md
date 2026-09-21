# Meal Prep App

React Router 8 (framework mode) on Cloudflare Workers, deployed at
https://meal-prep.karl-w-langer.workers.dev. The `meal-prep` D1 database is
the source of truth for everything: recipes, a canonical `ingredients` table
joined to recipes through `recipe_ingredients`, meal plans and shopping
lists. The `meal-prep-recipes` R2 bucket only holds recipe photos
(`recipes/<slug>.<ext>`). Markdown with YAML frontmatter survives purely as
an *input format*: the MCP `create_recipe` tool and `POST /recipes/import`
parse it into rows. The `recipes/` folder in this repo seeds local dev.

## Creating recipes

When asked to write a recipe document, follow `recipes/SCHEMA.md` exactly.
Key rules: `title` and `ingredients` are required; reuse existing ingredient
names (each name is one row in `ingredients`, and shopping lists merge on
it); prefer grams over cups; omit `quantity` for "to taste" items. An
ingredient's `category` is stored once on the ingredient — an import only
fills it in when it's unset; the edit form can change it.

In production, recipes are created and edited in the app's form
(`app/components/recipe-form.tsx`) or created by the MCP server's
`create_recipe` tool (see `workers/recipe-mcp.ts` and
`skills/recipe-clipper/`).

## Development

- Node 22 via nvm required (`source ~/.nvm/nvm.sh && nvm use 22`).
- `npm run dev` — local Workers runtime; local D1/R2 state under `.wrangler/state`.
- `npx vitest run` — unit + integration tests (real D1/R2 via Miniflare). Run before committing.
- Migrations: `npx wrangler d1 migrations apply meal-prep --local` (or `--remote`). drizzle-kit only generates schema changes; data moves are hand-written SQL appended to the migration.
- `npm run typecheck`, `npm run deploy`.
- Fresh local data: `./scripts/seed.sh` (dev server must be running).
- Key code: `app/lib/` (recipe-store, form + markdown parsers, shopping-list generator, auth),
  `app/routes/`, `database/schema.ts` (Drizzle → `migrations/`),
  `workers/app.ts` (entry: MCP secret path + password gate + React Router).
- Secrets: `MCP_SECRET` (MCP endpoint path), `APP_PASSWORD` (login gate;
  empty locally = gate off). See `.dev.vars`.
- Deploys are pinned to the personal Cloudflare account via `account_id` in
  `wrangler.jsonc`; wrangler authenticates with `CLOUDFLARE_API_TOKEN` from
  `.env` (see `.env.example`), not the machine's `wrangler login` session.
