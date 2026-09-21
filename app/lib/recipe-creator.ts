import { eq } from "drizzle-orm";
import { recipes } from "../../database/schema";
import { MAX_RECIPE_FILE_CHARS } from "./config";
import type { Db } from "./db";
import { probeImage } from "./recipe-images";
import { parseRecipe, RecipeParseError } from "./recipe-parser";
import { insertRecipe } from "./recipe-store";

export type CreateRecipeResult =
  | { ok: true; slug: string; warnings: string[] }
  | { ok: false; error: string };

/**
 * Import a new recipe from raw .md content: validate, reject duplicate
 * slugs, and store it in D1. Markdown is only the input format here — the
 * MCP create_recipe tool and the seed script speak it; nothing is written
 * to R2. Errors come back as descriptive messages (not throws) so an LLM
 * can act on them.
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

  const { data, warnings } = parsed;

  const existing = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.slug, data.slug))
    .limit(1);

  if (existing.length > 0) {
    return {
      ok: false,
      error: `A recipe with the slug "${data.slug}" already exists.`,
    };
  }

  // A photo may have been uploaded to the bucket ahead of the recipe.
  const image = await probeImage(bucket, data.slug);

  const { slug, ingredients, rating, meta, image: _image, ...fields } = data;

  await insertRecipe(db, slug, fields, ingredients, {
    rating,
    meta,
    image_key: image?.key ?? null,
    image_etag: image?.etag ?? null,
  });

  return { ok: true, slug, warnings };
}
