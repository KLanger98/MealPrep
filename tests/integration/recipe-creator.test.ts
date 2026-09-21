import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { recipes } from "../../database/schema";
import { MAX_RECIPE_FILE_CHARS } from "../../app/lib/config";
import { getDb } from "../../app/lib/db";
import { createRecipe } from "../../app/lib/recipe-creator";
import { loadIngredients } from "../../app/lib/recipe-store";

const db = getDb(env.DB);

const VALID = `---
title: Test Tacos
slug: test-tacos
type: dinner
servings: 2
ingredients:
  - name: tortillas
    quantity: 4
    unit: whole
---
## Method
Assemble.`;

describe("createRecipe", () => {
  it("stores the recipe in D1 and writes no file", async () => {
    const result = await createRecipe(db, env.RECIPES, VALID);

    expect(result).toEqual({ ok: true, slug: "test-tacos", warnings: [] });
    expect((await env.RECIPES.list()).objects).toHaveLength(0);

    const rows = await db
      .select()
      .from(recipes)
      .where(eq(recipes.slug, "test-tacos"));
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Test Tacos");
    expect(await loadIngredients(db, rows[0].id)).toMatchObject([
      { name: "tortillas", quantity: 4, unit: "whole" },
    ]);
  });

  it("picks up a photo already in the bucket", async () => {
    await env.RECIPES.put("recipes/test-tacos.jpg", "jpeg-bytes");
    await createRecipe(db, env.RECIPES, VALID);

    const [row] = await db.select().from(recipes).where(eq(recipes.slug, "test-tacos"));
    expect(row.image_key).toBe("recipes/test-tacos.jpg");
  });

  it("propagates parser warnings", async () => {
    const noServings = VALID.replace("servings: 2\n", "");
    const result = await createRecipe(db, env.RECIPES, noServings);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.join(" ")).toContain("servings");
    }
  });

  it("returns the parse error without writing anything", async () => {
    const result = await createRecipe(db, env.RECIPES, "---\ntitle: [broken\n---\n");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid YAML");
    }
    expect((await env.RECIPES.list({ prefix: "recipes/" })).objects).toHaveLength(0);
    expect(await db.select().from(recipes)).toHaveLength(0);
  });

  it("rejects a duplicate slug and leaves the original untouched", async () => {
    await createRecipe(db, env.RECIPES, VALID);
    const result = await createRecipe(
      db,
      env.RECIPES,
      VALID.replace("title: Test Tacos", "title: Other Tacos"),
    );

    expect(result).toEqual({
      ok: false,
      error: 'A recipe with the slug "test-tacos" already exists.',
    });

    const rows = await db.select().from(recipes);
    expect(rows.map((r) => r.title)).toEqual(["Test Tacos"]);
  });

  it("rejects empty and oversize content", async () => {
    expect((await createRecipe(db, env.RECIPES, "")).ok).toBe(false);
    expect(
      (await createRecipe(db, env.RECIPES, "x".repeat(MAX_RECIPE_FILE_CHARS + 1))).ok,
    ).toBe(false);
  });
});
