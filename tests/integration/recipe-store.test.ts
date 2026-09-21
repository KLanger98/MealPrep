import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Ingredient } from "../../database/schema";
import { ingredients, recipeIngredients, recipes } from "../../database/schema";
import { getDb } from "../../app/lib/db";
import {
  insertRecipe,
  listKnownIngredients,
  loadIngredients,
  updateRecipe,
  type RecipeFields,
} from "../../app/lib/recipe-store";

const db = getDb(env.DB);

const FIELDS: RecipeFields = {
  title: "Tacos",
  type: "dinner",
  protein: null,
  cost: null,
  source: null,
  prep_minutes: null,
  cook_minutes: null,
  servings: 2,
  tags: [],
  body_markdown: "",
};

async function recipeId(slug: string): Promise<number> {
  const [row] = await db.select({ id: recipes.id }).from(recipes).where(eq(recipes.slug, slug));
  return row.id;
}

describe("recipe store", () => {
  it("stores lines in order and reuses an ingredient across recipes", async () => {
    await insertRecipe(db, "tacos", FIELDS, [
      { name: "  Limes ", quantity: 2, unit: "whole", category: "produce" },
      { name: "salt", note: "to taste" },
    ]);
    await insertRecipe(db, "salsa", { ...FIELDS, title: "Salsa" }, [
      { name: "limes", quantity: 1, unit: "whole" },
    ]);

    expect(await loadIngredients(db, await recipeId("tacos"))).toMatchObject([
      { name: "limes", quantity: 2, unit: "whole", category: "produce" },
      { name: "salt", quantity: null, note: "to taste" },
    ]);

    // One canonical "limes" row, shared — and salsa's line inherits its aisle.
    expect((await listKnownIngredients(db)).map((i) => i.name)).toEqual(["limes", "salt"]);
    expect(await loadIngredients(db, await recipeId("salsa"))).toMatchObject([
      { name: "limes", category: "produce" },
    ]);
  });

  it("an import fills a missing category but never overwrites one", async () => {
    await insertRecipe(db, "a", FIELDS, [{ name: "limes" }]);
    await insertRecipe(db, "b", FIELDS, [{ name: "limes", category: "produce" }]);
    await insertRecipe(db, "c", FIELDS, [{ name: "limes", category: "other" }]);

    expect(await listKnownIngredients(db)).toEqual([{ name: "limes", category: "produce" }]);
  });

  it("an edit replaces the lines and can recategorise an ingredient", async () => {
    await insertRecipe(db, "tacos", FIELDS, [
      { name: "limes", quantity: 2, unit: "whole", category: "other" },
      { name: "salt" },
    ]);
    const lines: Ingredient[] = [
      { name: "limes", quantity: 3, unit: "whole", category: "produce" },
    ];

    await updateRecipe(db, "tacos", { ...FIELDS, title: "Better Tacos" }, lines);

    const [row] = await db.select().from(recipes).where(eq(recipes.slug, "tacos"));
    expect(row.title).toBe("Better Tacos");
    expect(await loadIngredients(db, row.id)).toMatchObject([
      { name: "limes", quantity: 3, category: "produce" },
    ]);
    expect(await db.select().from(recipeIngredients)).toHaveLength(1);
  });

  it("keeps the same ingredient listed twice in one recipe", async () => {
    await insertRecipe(db, "tacos", FIELDS, [
      { name: "salt", quantity: 1, unit: "tsp" },
      { name: "salt", note: "to finish" },
    ]);

    expect(await loadIngredients(db, await recipeId("tacos"))).toHaveLength(2);
    expect(await db.select().from(ingredients)).toHaveLength(1);
  });

  it("deleting a recipe removes its lines but keeps the ingredients", async () => {
    await insertRecipe(db, "tacos", FIELDS, [{ name: "limes" }]);
    await db.delete(recipes).where(eq(recipes.slug, "tacos"));

    expect(await db.select().from(recipeIngredients)).toHaveLength(0);
    expect(await db.select().from(ingredients)).toHaveLength(1);
  });
});
