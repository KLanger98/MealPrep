import { env } from "cloudflare:test";
import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Ingredient } from "../../database/schema";
import {
  mealAssignments,
  recipes,
  shoppingListItems,
  shoppingLists,
} from "../../database/schema";
import { eachDay } from "../../app/lib/dates";
import { getDb } from "../../app/lib/db";
import { generate } from "../../app/lib/shopping-list-generator";

// Ported from tests/Feature/ShoppingListGeneratorTest.php
const db = getDb(env.DB);

async function makeRecipe(
  slug: string,
  ingredients: Ingredient[],
  servings = 4,
) {
  const [row] = await db
    .insert(recipes)
    .values({
      slug,
      title: slug.charAt(0).toUpperCase() + slug.slice(1),
      type: "dinner",
      servings,
      tags: [],
      ingredients,
      r2_key: `recipes/${slug}.md`,
      etag: `etag-${slug}`,
    })
    .returning({ id: recipes.id });

  return row;
}

async function assign(
  recipe: { id: number },
  start: string,
  end: string,
  scale = 1,
  slot = "dinner",
): Promise<string> {
  const batchId = crypto.randomUUID();

  for (const date of eachDay(start, end)) {
    await db.insert(mealAssignments).values({
      recipe_id: recipe.id,
      date,
      slot,
      batch_id: batchId,
      scale_factor: scale,
    });
  }

  return batchId;
}

async function generateList(start: string, end: string) {
  const [list] = await db
    .insert(shoppingLists)
    .values({ start_date: start, end_date: end })
    .returning();

  await generate(db, list);

  return items(list.id);
}

async function items(listId: number) {
  return db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.shopping_list_id, listId))
    .orderBy(asc(shoppingListItems.sort_order));
}

describe("shopping list generator", () => {
  it("sums the same ingredient with the same unit", async () => {
    const a = await makeRecipe("a", [
      { name: "long-grain rice", quantity: 2, unit: "cup", note: null, category: "pantry" },
    ]);
    const b = await makeRecipe("b", [
      { name: "long-grain rice", quantity: 1, unit: "cup", note: null, category: "pantry" },
    ]);
    await assign(a, "2026-07-06", "2026-07-06");
    await assign(b, "2026-07-07", "2026-07-07");

    const list = await generateList("2026-07-06", "2026-07-12");

    const rice = list.find((i) => i.name === "long-grain rice")!;
    expect(rice.quantity).toBe(3);
    expect(rice.unit).toBe("cup");
    expect(rice.sources).toHaveLength(2);
  });

  it("merges and humanizes metric pairs", async () => {
    const a = await makeRecipe("a", [
      { name: "beef mince", quantity: 1, unit: "kg", note: null, category: "meat" },
    ]);
    const b = await makeRecipe("b", [
      { name: "beef mince", quantity: 800, unit: "g", note: null, category: "meat" },
    ]);
    await assign(a, "2026-07-06", "2026-07-06");
    await assign(b, "2026-07-07", "2026-07-07");

    const list = await generateList("2026-07-06", "2026-07-12");

    const beef = list.find((i) => i.name === "beef mince")!;
    expect(beef.quantity).toBe(1.8);
    expect(beef.unit).toBe("kg");
  });

  it("keeps incompatible units on separate lines", async () => {
    const a = await makeRecipe("a", [
      { name: "olive oil", quantity: 2, unit: "tbsp", note: null, category: "pantry" },
    ]);
    const b = await makeRecipe("b", [
      { name: "olive oil", quantity: 100, unit: "ml", note: null, category: "pantry" },
    ]);
    await assign(a, "2026-07-06", "2026-07-06");
    await assign(b, "2026-07-07", "2026-07-07");

    const list = await generateList("2026-07-06", "2026-07-12");

    const oil = list.filter((i) => i.name === "olive oil");
    expect(oil).toHaveLength(2);
    expect(oil.map((i) => i.unit).sort()).toEqual(["ml", "tbsp"]);
  });

  it("multiplies quantities by the scale factor", async () => {
    const recipe = await makeRecipe("a", [
      { name: "chicken thighs", quantity: 800, unit: "g", note: null, category: "meat" },
    ]);
    await assign(recipe, "2026-07-06", "2026-07-06", 1.5);

    const list = await generateList("2026-07-06", "2026-07-12");

    const chicken = list.find((i) => i.name === "chicken thighs")!;
    expect(chicken.quantity).toBe(1.2);
    expect(chicken.unit).toBe("kg");
  });

  it("counts a multi-day batch once", async () => {
    const recipe = await makeRecipe("a", [
      { name: "chicken thighs", quantity: 800, unit: "g", note: null, category: "meat" },
    ]);
    await assign(recipe, "2026-07-06", "2026-07-08");

    const list = await generateList("2026-07-06", "2026-07-12");

    const chicken = list.find((i) => i.name === "chicken thighs")!;
    expect(chicken.quantity).toBe(800);
  });

  it("includes a partially overlapping batch whole", async () => {
    const recipe = await makeRecipe("a", [
      { name: "chicken thighs", quantity: 800, unit: "g", note: null, category: "meat" },
    ]);
    // Batch spans Sun–Tue; list range starts Mon.
    await assign(recipe, "2026-07-05", "2026-07-07");

    const list = await generateList("2026-07-06", "2026-07-12");

    const chicken = list.find((i) => i.name === "chicken thighs")!;
    expect(chicken.quantity).toBe(800);
  });

  it("counts two separate batches of the same recipe", async () => {
    const recipe = await makeRecipe("a", [
      { name: "chicken thighs", quantity: 800, unit: "g", note: null, category: "meat" },
    ]);
    await assign(recipe, "2026-07-06", "2026-07-07");
    await assign(recipe, "2026-07-09", "2026-07-10");

    const list = await generateList("2026-07-06", "2026-07-12");

    const chicken = list.find((i) => i.name === "chicken thighs")!;
    expect(chicken.quantity).toBe(1.6);
    expect(chicken.unit).toBe("kg");
  });

  it("shows unquantified items once without a quantity", async () => {
    const a = await makeRecipe("a", [
      { name: "salt", quantity: null, unit: null, note: "to taste", category: "pantry" },
    ]);
    const b = await makeRecipe("b", [
      { name: "salt", quantity: null, unit: null, note: "to taste", category: "pantry" },
    ]);
    await assign(a, "2026-07-06", "2026-07-06", 2);
    await assign(b, "2026-07-07", "2026-07-07");

    const list = await generateList("2026-07-06", "2026-07-12");

    const salt = list.filter((i) => i.name === "salt");
    expect(salt).toHaveLength(1);
    expect(salt[0].quantity).toBeNull();
  });

  it("excludes assignments outside the range", async () => {
    const recipe = await makeRecipe("a", [
      { name: "chicken thighs", quantity: 800, unit: "g", note: null, category: "meat" },
    ]);
    await assign(recipe, "2026-07-20", "2026-07-21");

    const list = await generateList("2026-07-06", "2026-07-12");

    expect(list).toHaveLength(0);
  });

  it("groups items by category order", async () => {
    const recipe = await makeRecipe("a", [
      { name: "flour", quantity: 500, unit: "g", note: null, category: "pantry" },
      { name: "carrots", quantity: 2, unit: "whole", note: null, category: "produce" },
      { name: "beef mince", quantity: 500, unit: "g", note: null, category: "meat" },
    ]);
    await assign(recipe, "2026-07-06", "2026-07-06");

    const list = await generateList("2026-07-06", "2026-07-12");

    expect(list.map((i) => i.category)).toEqual(["produce", "meat", "pantry"]);
  });

  it("preserves checked state across regeneration by name and unit", async () => {
    const recipe = await makeRecipe("a", [
      { name: "chicken thighs", quantity: 800, unit: "g", note: null, category: "meat" },
      { name: "rice", quantity: 2, unit: "cup", note: null, category: "pantry" },
    ]);
    await assign(recipe, "2026-07-06", "2026-07-06");

    const [list] = await db
      .insert(shoppingLists)
      .values({ start_date: "2026-07-06", end_date: "2026-07-12" })
      .returning();
    await generate(db, list);

    const before = await items(list.id);
    const riceBefore = before.find((i) => i.name === "rice")!;
    await db
      .update(shoppingListItems)
      .set({ checked_at: new Date().toISOString() })
      .where(eq(shoppingListItems.id, riceBefore.id));

    // Add another batch, then regenerate.
    const other = await makeRecipe("b", [
      { name: "rice", quantity: 1, unit: "cup", note: null, category: "pantry" },
    ]);
    await assign(other, "2026-07-08", "2026-07-08");
    await generate(db, list);

    const after = await items(list.id);
    const rice = after.find((i) => i.name === "rice")!;
    expect(rice.quantity).toBe(3);
    expect(rice.checked_at, "Checked state should survive regeneration").not.toBeNull();
    expect(after.find((i) => i.name === "chicken thighs")!.checked_at).toBeNull();
  });

  it("merges unit aliases", async () => {
    const a = await makeRecipe("a", [
      { name: "butter", quantity: 2, unit: "tablespoons", note: null, category: "dairy" },
    ]);
    const b = await makeRecipe("b", [
      { name: "butter", quantity: 1, unit: "tbsp", note: null, category: "dairy" },
    ]);
    await assign(a, "2026-07-06", "2026-07-06");
    await assign(b, "2026-07-07", "2026-07-07");

    const list = await generateList("2026-07-06", "2026-07-12");

    const butter = list.filter((i) => i.name === "butter");
    expect(butter).toHaveLength(1);
    expect(butter[0].quantity).toBe(3);
  });
});
