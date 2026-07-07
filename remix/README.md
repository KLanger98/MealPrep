# Meal Prep — Cloudflare Workers app

React Router 8 (framework mode) on Cloudflare Workers. Recipe `.md` files
(YAML frontmatter + Markdown, see `../recipes/SCHEMA.md`) live in the
`meal-prep-recipes` R2 bucket and are the source of truth; the `meal-prep`
D1 database indexes them and holds meal plans and shopping lists.

Live at https://meal-prep.karl-w-langer.workers.dev

## Development

Node 22 via nvm is required.

```bash
npm install
npm run dev        # local Workers runtime, local D1/R2 under .wrangler/state
npx vitest run     # unit + integration tests (real D1/R2 via Miniflare)
npm run typecheck
npm run deploy     # build + wrangler deploy
```

Seed a fresh local environment (dev server must be running for the sync step):

```bash
./scripts/seed.sh                 # uploads ../recipes/* to local R2 + POST /sync
./scripts/export-plan-data.sh     # copies meal plans from the old Laravel SQLite DB
```

Both scripts accept `--remote` to target the real bucket/database.

Recipes edited in-app write back to R2 and re-index automatically. Files
dropped straight into the bucket (`wrangler r2 object put`) need a resync:
the banner's Resync button or `curl -X POST <app>/sync`.

## MCP server & recipe-clipper skill

The Worker also serves a remote MCP server so Claude (via a claude.ai custom
connector) can save recipes — e.g. from a URL or photo shared to Claude on
iOS, guided by the `../skills/recipe-clipper` skill.

**Endpoint**: `https://meal-prep.karl-w-langer.workers.dev/mcp/<MCP_SECRET>` —
the secret path is the auth (Claude connectors don't support bearer tokens).
Anything else under `/mcp` returns 404.

**Tools** (implemented in `workers/recipe-mcp.ts`, Durable Object `RecipeMcp`):

- `get_recipe_context` — SCHEMA.md + live vocabulary (ingredient names, tags,
  types, proteins, slugs) so the model reuses consistent ingredient names.
- `create_recipe` — validate + write a new `.md` to R2 + index into D1.
- `list_recipes` — slugs/titles/types/proteins/ratings.
- `get_recipe` — full `.md` content by slug.

**Setup**:

1. Secret: `MCP_SECRET=dev-secret` in `.dev.vars` locally; in prod
   `openssl rand -hex 24` then `npx wrangler secret put MCP_SECRET`.
2. Connector: claude.ai → Settings → Connectors → Add custom connector →
   paste the full secret URL, no auth.
3. If Cloudflare Access guards the domain: add a Zero Trust self-hosted app
   scoped to the `/mcp` path with a single **Bypass — Everyone** policy so
   the connector isn't blocked by the login wall.
4. Skill: `cd ../skills && zip -r recipe-clipper.zip recipe-clipper`, then
   claude.ai → Settings → Capabilities → Skills → upload the zip.

Rotate the secret with `wrangler secret put MCP_SECRET` + update the
connector URL.
