import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { recipeImportErrors, recipes } from "../../database/schema";
import { getDb } from "../../app/lib/db";
import { fullSync } from "../../app/lib/recipe-syncer";

// Ported from tests/Feature/RecipeSyncTest.php, with R2 in place of the
// filesystem and the object etag in place of mtime + md5.
const db = getDb(env.DB);

async function writeRecipe(key: string, slug: string, title = "A Recipe") {
  await env.RECIPES.put(
    `recipes/${key}`,
    `---
title: ${title}
slug: ${slug}
servings: 2
ingredients:
  - name: rice
    quantity: 1
    unit: cup
---
## Method
Cook.`,
  );
}

const sync = () => fullSync(db, env.RECIPES);

async function allRecipes() {
  return db.select().from(recipes);
}

async function bySlug(slug: string) {
  const rows = await db.select().from(recipes).where(eq(recipes.slug, slug));
  return rows[0];
}

describe("recipe syncer", () => {
  it("indexes new files", async () => {
    await writeRecipe("one.md", "one");
    await writeRecipe("two.md", "two");

    const result = await sync();

    expect(result.created).toHaveLength(2);
    expect(await allRecipes()).toHaveLength(2);
  });

  it("skips unchanged files on resync", async () => {
    await writeRecipe("one.md", "one");

    await sync();
    const result = await sync();

    expect(result.created).toEqual([]);
    expect(result.unchanged).toEqual(["one"]);
  });

  it("reparses edited files", async () => {
    await writeRecipe("one.md", "one", "Old Title");
    await sync();

    await writeRecipe("one.md", "one", "New Title");
    const result = await sync();

    expect(result.updated).toEqual(["one"]);
    expect((await bySlug("one")).title).toBe("New Title");
  });

  it("updates a renamed file with the same slug in place", async () => {
    await writeRecipe("old-name.md", "stable-slug");
    await sync();

    const contents = await env.RECIPES.get("recipes/old-name.md");
    await env.RECIPES.put("recipes/new-name.md", await contents!.text());
    await env.RECIPES.delete("recipes/old-name.md");
    await sync();

    expect(await allRecipes()).toHaveLength(1);
    const recipe = await bySlug("stable-slug");
    expect(recipe.r2_key.endsWith("new-name.md")).toBe(true);
    expect(recipe.missing_at).toBeNull();
  });

  it("marks deleted files missing instead of deleting them", async () => {
    await writeRecipe("one.md", "one");
    await sync();

    await env.RECIPES.delete("recipes/one.md");
    const result = await sync();

    expect(result.missing).toEqual(["one"]);
    expect((await bySlug("one")).missing_at).not.toBeNull();

    // File comes back -> missing flag clears.
    await writeRecipe("one.md", "one");
    await sync();
    expect((await bySlug("one")).missing_at).toBeNull();
  });

  it("skips and records invalid files", async () => {
    await writeRecipe("good.md", "good");
    await env.RECIPES.put("recipes/bad.md", "---\ntitle: [broken\n---\nBody");

    const result = await sync();

    expect(Object.keys(result.errors)).toHaveLength(1);
    expect(await allRecipes()).toHaveLength(1);
    const errors = await db
      .select()
      .from(recipeImportErrors)
      .where(eq(recipeImportErrors.level, "error"));
    expect(errors).toHaveLength(1);
  });

  it("keeps the first file and records an error for duplicate slugs", async () => {
    await writeRecipe("a.md", "same-slug");
    await writeRecipe("b.md", "same-slug");

    const result = await sync();

    expect(await allRecipes()).toHaveLength(1);
    expect(Object.keys(result.errors)).toHaveLength(1);
    const errors = await db
      .select()
      .from(recipeImportErrors)
      .where(eq(recipeImportErrors.level, "error"));
    expect(errors[0].message).toContain("Duplicate slug");
  });

  it("ignores SCHEMA.md and README.md", async () => {
    await env.RECIPES.put("recipes/SCHEMA.md", "# Not a recipe");
    await writeRecipe("one.md", "one");

    const result = await sync();

    expect(result.errors).toEqual({});
    expect(await allRecipes()).toHaveLength(1);
  });

  it("scans subdirectories", async () => {
    await writeRecipe("dinners/nested.md", "nested");

    await sync();

    expect(await allRecipes()).toHaveLength(1);
  });

  it("clears import errors on each sync", async () => {
    await env.RECIPES.put("recipes/bad.md", "---\ntitle: [broken\n---\n");
    await sync();
    expect(await db.select().from(recipeImportErrors)).toHaveLength(1);

    await env.RECIPES.delete("recipes/bad.md");
    await sync();
    expect(await db.select().from(recipeImportErrors)).toHaveLength(0);
  });

  it("resolves sibling images into image_key", async () => {
    await writeRecipe("one.md", "one");
    await env.RECIPES.put("recipes/one.jpg", new Uint8Array([1, 2, 3]));

    await sync();

    const recipe = await bySlug("one");
    expect(recipe.image_key).toBe("recipes/one.jpg");
    expect(recipe.image_etag).not.toBeNull();
  });

  it("picks up photo changes for unchanged recipes", async () => {
    await writeRecipe("one.md", "one");
    await sync();
    expect((await bySlug("one")).image_key).toBeNull();

    await env.RECIPES.put("recipes/one.jpg", new Uint8Array([1, 2, 3]));
    await sync();

    expect((await bySlug("one")).image_key).toBe("recipes/one.jpg");
  });
});
