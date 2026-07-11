import { env } from "cloudflare:workers";
import { data } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/image";
import { recipes } from "../../../database/schema";
import { IMAGE_EXTENSIONS, MAX_PHOTO_BYTES } from "../../lib/config";
import { getDb } from "../../lib/db";
import { removeFrontmatterKey } from "../../lib/frontmatter-surgery";
import { syncOne } from "../../lib/recipe-syncer";

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

async function findRecipe(slug: string) {
  const rows = await getDb(env.DB)
    .select()
    .from(recipes)
    .where(eq(recipes.slug, slug))
    .limit(1);

  if (!rows[0]) throw data(null, 404);
  return rows[0];
}

/** The .md key without extension: 'recipes/beef-chilli'. */
function baseKey(r2Key: string): string {
  return r2Key.replace(/\.md$/, "");
}

/** Every existing sibling image object (same basename as the .md). */
async function siblingImageKeys(base: string): Promise<string[]> {
  const listing = await env.RECIPES.list({ prefix: `${base}.` });
  const suffixes = IMAGE_EXTENSIONS.map((ext) => `.${ext}`);
  return listing.objects
    .map((o) => o.key)
    .filter((key) => suffixes.some((s) => key.toLowerCase().endsWith(s)));
}

/**
 * Re-parse and re-index the .md after an image change so the denormalised
 * image_key/image_etag columns stay accurate. A frontmatter `image:` path
 * would shadow uploads and deletions — drop it (same as the Laravel app).
 */
async function dropImageKeyAndResync(r2Key: string): Promise<void> {
  const object = await env.RECIPES.get(r2Key);
  if (object === null) return;

  let contents = await object.text();
  let etag = object.etag;

  const updated = removeFrontmatterKey(contents, "image");
  if (updated !== contents) {
    const put = await env.RECIPES.put(r2Key, updated, {
      httpMetadata: { contentType: "text/markdown" },
    });
    contents = updated;
    etag = put!.etag;
  }

  await syncOne(getDb(env.DB), env.RECIPES, r2Key, contents, etag);
}

// GET /recipes/:slug/image — stream the photo from R2. The URL carries
// ?v=<etag>, so far-future caching is safe.
export async function loader({ params }: Route.LoaderArgs) {
  const recipe = await findRecipe(params.slug);

  if (recipe.image_key === null) throw data(null, 404);

  const object = await env.RECIPES.get(recipe.image_key);
  if (object === null) throw data(null, 404);

  const ext = recipe.image_key.slice(recipe.image_key.lastIndexOf(".") + 1).toLowerCase();

  return new Response(object.body, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType ?? EXT_TO_MIME[ext] ?? "application/octet-stream",
      "Content-Length": String(object.size),
      ETag: object.httpEtag,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function action({ request, params }: Route.ActionArgs) {
  const recipe = await findRecipe(params.slug);
  const base = baseKey(recipe.r2_key);

  if (request.method === "DELETE") {
    const keys = await siblingImageKeys(base);
    if (keys.length > 0) await env.RECIPES.delete(keys);
    await dropImageKeyAndResync(recipe.r2_key);
    return { ok: true };
  }

  const form = await request.formData();
  const photo = form.get("photo");

  if (!(photo instanceof File)) {
    return data({ errors: { photo: "Choose an image file to upload." } }, 422);
  }

  const ext = MIME_TO_EXT[photo.type];
  if (!ext) {
    return data(
      { errors: { photo: "The photo must be a JPEG, PNG, WebP or GIF." } },
      422,
    );
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return data({ errors: { photo: "The photo must be 15MB or smaller." } }, 422);
  }

  // Replace whatever sibling image exists, whatever its extension.
  const existing = await siblingImageKeys(base);
  if (existing.length > 0) await env.RECIPES.delete(existing);

  await env.RECIPES.put(`${base}.${ext}`, photo.stream(), {
    httpMetadata: { contentType: photo.type },
  });

  await dropImageKeyAndResync(recipe.r2_key);

  return { ok: true };
}
