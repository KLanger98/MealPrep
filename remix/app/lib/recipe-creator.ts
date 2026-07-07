import { eq } from "drizzle-orm";
import { recipes } from "../../database/schema";
import { MAX_RECIPE_FILE_CHARS, RECIPES_PREFIX } from "./config";
import type { Db } from "./db";
import { parseRecipe, RecipeParseError } from "./recipe-parser";
import { syncOne } from "./recipe-syncer";

export type CreateRecipeResult =
  | { ok: true; slug: string; warnings: string[] }
  | { ok: false; error: string };

/**
 * Create a new recipe from raw .md content: validate, reject duplicate
 * slugs, write to R2, and index into D1. Shared by the in-app editor route
 * and the MCP create_recipe tool. Errors come back as descriptive messages
 * (not throws) so both a form and an LLM can act on them.
 */
export async function createRecipe(
  db: Db,
  bucket: R2Bucket,
  content: string,
): Promise<CreateRecipeResult> {
  if (content.length === 0) {
    return { ok: false, error: "The recipe file can't be empty." };
  }
  if (content.length > MAX_RECIPE_FILE_CHARS) {
    return { ok: false, error: "The recipe file is too large." };
  }

  let parsed;
  try {
    parsed = parseRecipe(content);
  } catch (e) {
    if (e instanceof RecipeParseError) {
      return { ok: false, error: e.message };
    }
    throw e;
  }

  const slug = parsed.data.slug;
  const key = `${RECIPES_PREFIX}${slug}.md`;

  const existing = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.slug, slug))
    .limit(1);

  if (existing.length > 0 || (await bucket.head(key)) !== null) {
    return {
      ok: false,
      error: `A recipe with the slug "${slug}" already exists.`,
    };
  }

  const object = await bucket.put(key, content, {
    httpMetadata: { contentType: "text/markdown" },
  });

  const synced = await syncOne(db, bucket, key, content, object!.etag);
  if (!synced.ok) {
    return { ok: false, error: synced.error };
  }

  return { ok: true, slug: synced.slug, warnings: synced.warnings };
}
