import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { recipes } from "../../database/schema";
import { getDb } from "../../app/lib/db";
import { listKnownIngredients, loadIngredients } from "../../app/lib/recipe-store";

const db = getDb(env.DB);

/** The hand-written INSERT … SELECT statements from migration 0001. */
function backfillStatements(): string[] {
  const migration = env.TEST_MIGRATIONS.find((m) => m.name.startsWith("0001"));
  return migration!.queries.filter((q) => /INSERT INTO/i.test(q));
}

async function legacyRecipe(slug: string, ingredients: object[]) {
  const [row] = await db
    .insert(recipes)
    .values({
      slug,
      title: slug,
      servings: 2,
      ingredients: ingredients as never,
      r2_key: `recipes/${slug}.md`,
      etag: "etag",
    })
    .returning({ id: recipes.id });
  return row.id;
}

describe("0001 ingredient backfill", () => {
  it("moves legacy JSON ingredients into the new tables", async () => {
    const tacos = await legacyRecipe("tacos", [
      { name: "Limes ", quantity: 2, unit: "whole", note: "juiced", category: "produce" },
      { name: "salt", quantity: null, unit: null, note: "to taste", category: "pantry" },
    ]);
    const salsa = await legacyRecipe("salsa", [
      { name: "limes", quantity: 0.5, unit: "whole", category: "produce" },
      { name: "salt", category: "other" },
      { name: "salt", category: "pantry" },
    ]);
    await legacyRecipe("empty", []);

    const statements = backfillStatements();
    expect(statements).toHaveLength(2);
    for (const statement of statements) await env.DB.exec(statement.replace(/\s+/g, " "));

    // Distinct normalised names; the most common category wins a disagreement.
    expect(await listKnownIngredients(db)).toEqual([
      { name: "limes", category: "produce" },
      { name: "salt", category: "pantry" },
    ]);

    expect(await loadIngredients(db, tacos)).toMatchObject([
      { name: "limes", quantity: 2, unit: "whole", note: "juiced" },
      { name: "salt", quantity: null, unit: null, note: "to taste" },
    ]);
    expect(await loadIngredients(db, salsa)).toHaveLength(3);

    // Every JSON line became exactly one row.
    const counts = await env.DB.prepare(
      `SELECT (SELECT count(*) FROM recipes, json_each(recipes.ingredients)) AS json_lines,
              (SELECT count(*) FROM recipe_ingredients) AS table_rows`,
    ).first<{ json_lines: number; table_rows: number }>();
    expect(counts).toEqual({ json_lines: 5, table_rows: 5 });
  });
});
