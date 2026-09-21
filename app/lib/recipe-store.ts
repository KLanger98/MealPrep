import { asc, eq, inArray, sql } from "drizzle-orm";
import type { Ingredient } from "../../database/schema";
import { ingredients, recipeIngredients, recipes } from "../../database/schema";
import type { Db } from "./db";

/**
 * The identity of an ingredient: shopping lists merge on it and the
 * ingredients table is unique on it. Must stay in step with the
 * lower(trim(...)) used by the 0001 backfill migration.
 */
export function normalizeIngredientName(name: string): string {
  return name.trim().toLowerCase();
}

/** The recipe columns a create or edit is allowed to set. */
export interface RecipeFields {
  title: string;
  type: string;
  protein: string | null;
  cost: string | null;
  source: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number;
  tags: string[];
  body_markdown: string;
}

/** Extra columns only an import (the markdown path) can carry. */
export interface ImportedFields {
  rating: number | null;
  meta: Record<string, unknown> | null;
  image_key: string | null;
  image_etag: string | null;
}

function cleanLines(lines: Ingredient[]): Ingredient[] {
  return lines
    .map((line) => ({
      name: normalizeIngredientName(line.name),
      quantity: line.quantity ?? null,
      unit: line.unit ?? null,
      note: line.note ?? null,
      category: line.category ?? null,
    }))
    .filter((line) => line.name !== "");
}

/**
 * Statements that find-or-create each ingredient and replace the recipe's
 * lines. Ids are resolved with subqueries so the whole write — recipe row
 * included — fits in one atomic D1 batch.
 *
 * `overwriteCategories` is for the edit form, where a category is a
 * deliberate choice; imports only fill in a category that isn't set yet.
 */
function ingredientStatements(
  db: Db,
  slug: string,
  lines: Ingredient[],
  overwriteCategories: boolean,
) {
  const categoryByName = new Map<string, string | null>();
  for (const line of lines) {
    const known = categoryByName.get(line.name);
    if (known === undefined || known === null) {
      categoryByName.set(line.name, line.category ?? null);
    }
  }

  const upserts = [...categoryByName].map(([name, category]) =>
    db
      .insert(ingredients)
      .values({ name, category })
      .onConflictDoUpdate({
        target: ingredients.name,
        set: {
          category: overwriteCategories
            ? sql`coalesce(excluded.category, ${ingredients.category})`
            : sql`coalesce(${ingredients.category}, excluded.category)`,
        },
      }),
  );

  const recipeId = sql`(select ${recipes.id} from ${recipes} where ${recipes.slug} = ${slug})`;

  const clear = db
    .delete(recipeIngredients)
    .where(eq(recipeIngredients.recipe_id, recipeId));

  const inserts = lines.map((line, sortOrder) =>
    db.insert(recipeIngredients).values({
      recipe_id: recipeId,
      ingredient_id: sql`(select ${ingredients.id} from ${ingredients} where ${ingredients.name} = ${line.name})`,
      quantity: line.quantity ?? null,
      unit: line.unit ?? null,
      note: line.note ?? null,
      sort_order: sortOrder,
    }),
  );

  return { upserts, clear, inserts };
}

export async function insertRecipe(
  db: Db,
  slug: string,
  fields: RecipeFields,
  lines: Ingredient[],
  imported: Partial<ImportedFields> = {},
): Promise<void> {
  const cleaned = cleanLines(lines);
  const { upserts, clear, inserts } = ingredientStatements(db, slug, cleaned, false);

  const insert = db.insert(recipes).values({
    slug,
    ...fields,
    ...imported,
  });

  // D1 has no interactive transactions; a batch is atomic.
  await db.batch([...upserts, insert, clear, ...inserts] as unknown as [typeof insert]);
}

export async function updateRecipe(
  db: Db,
  slug: string,
  fields: RecipeFields,
  lines: Ingredient[],
): Promise<void> {
  const cleaned = cleanLines(lines);
  const { upserts, clear, inserts } = ingredientStatements(db, slug, cleaned, true);

  const update = db
    .update(recipes)
    .set(fields)
    .where(eq(recipes.slug, slug));

  await db.batch([...upserts, update, clear, ...inserts] as unknown as [typeof update]);
}

/** Ingredient lines for several recipes at once, in recipe order. */
export async function loadIngredientsFor(
  db: Db,
  recipeIds: number[],
): Promise<Map<number, (Ingredient & { ingredient_id: number })[]>> {
  const byRecipe = new Map<number, (Ingredient & { ingredient_id: number })[]>();
  if (recipeIds.length === 0) return byRecipe;

  const rows = await db
    .select({
      recipe_id: recipeIngredients.recipe_id,
      ingredient_id: recipeIngredients.ingredient_id,
      name: ingredients.name,
      category: ingredients.category,
      quantity: recipeIngredients.quantity,
      unit: recipeIngredients.unit,
      note: recipeIngredients.note,
    })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(recipeIngredients.ingredient_id, ingredients.id))
    .where(inArray(recipeIngredients.recipe_id, recipeIds))
    .orderBy(asc(recipeIngredients.sort_order), asc(recipeIngredients.id));

  for (const { recipe_id, ...line } of rows) {
    const lines = byRecipe.get(recipe_id) ?? [];
    lines.push(line);
    byRecipe.set(recipe_id, lines);
  }

  return byRecipe;
}

export async function loadIngredients(
  db: Db,
  recipeId: number,
): Promise<Ingredient[]> {
  return (await loadIngredientsFor(db, [recipeId])).get(recipeId) ?? [];
}

/** Every known ingredient, for autocomplete and the clipper's vocabulary. */
export async function listKnownIngredients(
  db: Db,
): Promise<{ name: string; category: string | null }[]> {
  return db
    .select({ name: ingredients.name, category: ingredients.category })
    .from(ingredients)
    .orderBy(asc(ingredients.name));
}
