import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recipes } from "../../database/schema";
import { getDb } from "../../app/lib/db";
import { importRecipeImage, MAX_IMPORTED_IMAGE_BYTES } from "../../app/lib/recipe-images";

const db = getDb(env.DB);

async function recipe() {
  const [row] = await db
    .insert(recipes)
    .values({ slug: "tacos", title: "Tacos", servings: 2 })
    .returning({ id: recipes.id, slug: recipes.slug, image_key: recipes.image_key });
  return row;
}

function stubFetch(body: BodyInit | null, init: ResponseInit = {}) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(body, init);
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("importRecipeImage", () => {
  it("stores the fetched photo and points the recipe at it", async () => {
    const target = await recipe();
    const calls = stubFetch("jpeg-bytes", { headers: { "Content-Type": "image/jpeg; charset=binary" } });

    const result = await importRecipeImage(db, env.RECIPES, target, "https://example.com/hero.jpg?w=1200");

    expect(result).toEqual({ ok: true, key: "recipes/tacos.jpg" });
    expect(calls).toEqual(["https://example.com/hero.jpg?w=1200"]);

    const object = await env.RECIPES.get("recipes/tacos.jpg");
    expect(await object!.text()).toBe("jpeg-bytes");
    expect(object!.httpMetadata?.contentType).toBe("image/jpeg");

    const [row] = await db.select().from(recipes).where(eq(recipes.id, target.id));
    expect(row.image_key).toBe("recipes/tacos.jpg");
    expect(row.image_etag).toBe(object!.etag);
  });

  it("replaces an existing photo of a different type", async () => {
    const target = await recipe();
    await env.RECIPES.put("recipes/tacos.png", "old");
    stubFetch("new", { headers: { "Content-Type": "image/webp" } });

    await importRecipeImage(db, env.RECIPES, target, "https://example.com/a.webp");

    expect(await env.RECIPES.head("recipes/tacos.png")).toBeNull();
    expect(await env.RECIPES.head("recipes/tacos.webp")).not.toBeNull();
  });

  it("rejects non-images, errors, oversize and non-public URLs without touching the recipe", async () => {
    const target = await recipe();

    stubFetch("<html>", { headers: { "Content-Type": "text/html" } });
    expect(await importRecipeImage(db, env.RECIPES, target, "https://example.com/page")).toMatchObject({
      ok: false,
      error: expect.stringContaining("not a JPEG"),
    });

    stubFetch(null, { status: 404 });
    expect(await importRecipeImage(db, env.RECIPES, target, "https://example.com/missing.jpg")).toMatchObject({
      error: "The image URL returned HTTP 404.",
    });

    stubFetch("x", {
      headers: { "Content-Type": "image/png", "Content-Length": String(MAX_IMPORTED_IMAGE_BYTES + 1) },
    });
    expect(await importRecipeImage(db, env.RECIPES, target, "https://example.com/huge.png")).toMatchObject({
      error: "The image is larger than 5MB.",
    });

    const calls = stubFetch("x", { headers: { "Content-Type": "image/png" } });
    expect((await importRecipeImage(db, env.RECIPES, target, "http://localhost/a.png")).ok).toBe(false);
    expect((await importRecipeImage(db, env.RECIPES, target, "http://10.0.0.1/a.png")).ok).toBe(false);
    expect((await importRecipeImage(db, env.RECIPES, target, "not a url")).ok).toBe(false);
    expect(calls).toEqual([]);

    const [row] = await db.select().from(recipes).where(eq(recipes.id, target.id));
    expect(row.image_key).toBeNull();
    expect((await env.RECIPES.list()).objects).toHaveLength(0);
  });
});
