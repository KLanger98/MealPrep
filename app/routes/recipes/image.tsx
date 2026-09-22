import { env } from "cloudflare:workers";
import { data } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/image";
import { recipes } from "../../../database/schema";
import { MAX_PHOTO_BYTES } from "../../lib/config";
import { getDb } from "../../lib/db";
import {
  clearRecipeImage,
  MIME_TO_EXT,
  replaceRecipeImage,
} from "../../lib/recipe-images";

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
    await clearRecipeImage(getDb(env.DB), env.RECIPES, recipe);
    return { ok: true };
  }

  const form = await request.formData();
  const photo = form.get("photo");

  if (!(photo instanceof File)) {
    return data({ errors: { photo: "Choose an image file to upload." } }, 422);
  }

  if (!MIME_TO_EXT[photo.type]) {
    return data(
      { errors: { photo: "The photo must be a JPEG, PNG, WebP or GIF." } },
      422,
    );
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return data({ errors: { photo: "The photo must be 15MB or smaller." } }, 422);
  }

  await replaceRecipeImage(getDb(env.DB), env.RECIPES, recipe, photo.stream(), photo.type);

  return { ok: true };
}
