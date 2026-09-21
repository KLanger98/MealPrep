import { env } from "cloudflare:workers";
import { data } from "react-router";
import type { Route } from "./+types/import";
import { getDb } from "../../lib/db";
import { createRecipe } from "../../lib/recipe-creator";

// Resource route: create a recipe from a raw .md body (SCHEMA.md format).
// Used by scripts/seed.sh; the MCP create_recipe tool shares createRecipe.
export async function action({ request }: Route.ActionArgs) {
  const result = await createRecipe(getDb(env.DB), env.RECIPES, await request.text());

  return data(result, result.ok ? 201 : 422);
}
