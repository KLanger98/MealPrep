import { env } from "cloudflare:workers";
import { data } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/image";
import { recipes } from "../../../database/schema";
import { MAX_PHOTO_BYTES } from "../../lib/config";
import { getDb } from "../../lib/db";
import { imageBaseKey, imageKeysFor } from "../../lib/recipe-images";

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

/**
 * Every photo object to clear for a recipe: whatever sits at
 * recipes/<slug>.<ext>, plus the indexed one (older recipes may keep theirs
 * in a subfolder).
 */
async function existingPhotoKeys(recipe: { slug: string; image_key: string | null }) {
  const keys = new Set((await imageKeysFor(env.RECIPES, recipe.slug)).map((p) => p.key));
  if (recipe.image_key !== null) keys.add(recipe.image_key);
  return [...keys];
}

async function setImage(recipeId: number, key: string | null, etag: string | null) {
  await getDb(env.DB)
    .update(recipes)
    .set({ image_key: key, image_etag: etag })
    .where(eq(recipes.id, recipeId));
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

  if (request.method === "DELETE") {
    const keys = await existingPhotoKeys(recipe);
    if (keys.length > 0) await env.RECIPES.delete(keys);
    await setImage(recipe.id, null, null);
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

  // Replace whatever photo exists, whatever its extension.
  const existing = await existingPhotoKeys(recipe);
  if (existing.length > 0) await env.RECIPES.delete(existing);

  const key = `${imageBaseKey(recipe.slug)}.${ext}`;
  const object = await env.RECIPES.put(key, photo.stream(), {
    httpMetadata: { contentType: photo.type },
  });

  await setImage(recipe.id, key, object!.etag);

  return { ok: true };
}
