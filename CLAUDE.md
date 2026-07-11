# Meal Prep App

React Router 8 (framework mode) on Cloudflare Workers, deployed at
https://meal-prep.karl-w-langer.workers.dev. Recipes are Markdown files with
YAML frontmatter — in production they live in the `meal-prep-recipes` R2
bucket (`recipes/<slug>.md`, the source of truth); the `meal-prep` D1
database only indexes them and holds meal plans and shopping lists. The
`recipes/` folder in this repo seeds local dev and acts as a backup.

## Creating recipes

When asked to create or edit a recipe, follow `recipes/SCHEMA.md` exactly.
Key rules: `title` and `ingredients` are required; keep ingredient names
consistent across recipes (shopping lists merge by exact name); prefer grams
over cups; omit `quantity` for "to taste" items. Recipe photos are sibling
R2 objects with the same basename (`beef-chilli.md` + `beef-chilli.jpg`).

In production, recipes are created via the app UI or the MCP server's
`create_recipe` tool (see `workers/recipe-mcp.ts` and
`skills/recipe-clipper/`).

## Development

- Node 22 via nvm required (`source ~/.nvm/nvm.sh && nvm use 22`).
- `npm run dev` — local Workers runtime; local D1/R2 state under `.wrangler/state`.
- `npx vitest run` — unit + integration tests (real D1/R2 via Miniflare). Run before committing.
- `npm run typecheck`, `npm run deploy`.
- Fresh local data: `./scripts/seed.sh` (dev server must be running).
- Key code: `app/lib/` (parsers, syncer, shopping-list generator, auth),
  `app/routes/`, `database/schema.ts` (Drizzle → `migrations/`),
  `workers/app.ts` (entry: MCP secret path + password gate + React Router).
- Secrets: `MCP_SECRET` (MCP endpoint path), `APP_PASSWORD` (login gate;
  empty locally = gate off). See `.dev.vars`.
