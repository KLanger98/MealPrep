import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { recipes } from "../../database/schema";
import { MAX_RECIPE_FILE_CHARS } from "../../app/lib/config";
import { getDb } from "../../app/lib/db";
import { createRecipe } from "../../app/lib/recipe-creator";

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
  it("creates the R2 object and D1 row", async () => {
    const result = await createRecipe(db, env.RECIPES, VALID);

    expect(result).toEqual({ ok: true, slug: "test-tacos", warnings: [] });
    expect(await env.RECIPES.head("recipes/test-tacos.md")).not.toBeNull();

    const rows = await db
      .select()
      .from(recipes)
      .where(eq(recipes.slug, "test-tacos"));
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Test Tacos");
    expect(rows[0].ingredients[0].name).toBe("tortillas");
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

    const object = await env.RECIPES.get("recipes/test-tacos.md");
    expect(await object!.text()).toContain("title: Test Tacos");
  });

  it("rejects empty and oversize content", async () => {
    expect((await createRecipe(db, env.RECIPES, "")).ok).toBe(false);
    expect(
      (await createRecipe(db, env.RECIPES, "x".repeat(MAX_RECIPE_FILE_CHARS + 1))).ok,
    ).toBe(false);
  });
});
