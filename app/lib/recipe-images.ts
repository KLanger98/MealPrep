import { eq } from "drizzle-orm";
import { recipes } from "../../database/schema";
import { IMAGE_EXTENSIONS, MAX_PHOTO_BYTES, RECIPES_PREFIX } from "./config";
import type { Db } from "./db";

export const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

// Fetched images aren't resized (Workers have no image library, and the
// browser-side resize only runs for uploads), so keep them modest.
export const MAX_IMPORTED_IMAGE_BYTES = 5 * 1024 * 1024;
const IMPORT_TIMEOUT_MS = 10_000;

export interface RecipeImageTarget {
  id: number;
  slug: string;
  image_key: string | null;
}

/** A recipe's photo objects live at recipes/<slug>.<ext>. */
export function imageBaseKey(slug: string): string {
  return `${RECIPES_PREFIX}${slug}`;
}

/** Every existing photo object for a slug, whatever its extension. */
export async function imageKeysFor(bucket: R2Bucket, slug: string) {
  const base = imageBaseKey(slug);
  const listing = await bucket.list({ prefix: `${base}.` });
  const byKey = new Map(listing.objects.map((o) => [o.key, o.etag]));

  return IMAGE_EXTENSIONS.flatMap((ext) => {
    const etag = byKey.get(`${base}.${ext}`);
    return etag === undefined ? [] : [{ key: `${base}.${ext}`, etag }];
  });
}

/** The photo already sitting in the bucket for a slug, if any. */
export async function probeImage(bucket: R2Bucket, slug: string) {
  return (await imageKeysFor(bucket, slug))[0] ?? null;
}

/**
 * Every photo object to clear for a recipe: whatever sits at
 * recipes/<slug>.<ext>, plus the indexed one (older recipes may keep theirs
 * in a subfolder).
 */
export async function existingImageKeys(bucket: R2Bucket, recipe: RecipeImageTarget) {
  const keys = new Set((await imageKeysFor(bucket, recipe.slug)).map((p) => p.key));
  if (recipe.image_key !== null) keys.add(recipe.image_key);
  return [...keys];
}

export async function clearRecipeImage(db: Db, bucket: R2Bucket, recipe: RecipeImageTarget) {
  const keys = await existingImageKeys(bucket, recipe);
  if (keys.length > 0) await bucket.delete(keys);
  await db
    .update(recipes)
    .set({ image_key: null, image_etag: null })
    .where(eq(recipes.id, recipe.id));
}

/** Store `body` as the recipe's photo, replacing whatever was there. */
export async function replaceRecipeImage(
  db: Db,
  bucket: R2Bucket,
  recipe: RecipeImageTarget,
  body: ReadableStream | ArrayBuffer,
  contentType: string,
) {
  const ext = MIME_TO_EXT[contentType];
  if (!ext) throw new Error(`Unsupported image type ${contentType}`);

  const existing = await existingImageKeys(bucket, recipe);
  if (existing.length > 0) await bucket.delete(existing);

  const key = `${imageBaseKey(recipe.slug)}.${ext}`;
  const object = await bucket.put(key, body, { httpMetadata: { contentType } });

  await db
    .update(recipes)
    .set({ image_key: key, image_etag: object!.etag })
    .where(eq(recipes.id, recipe.id));

  return { key, etag: object!.etag };
}

export type ImportImageResult = { ok: true; key: string } | { ok: false; error: string };

/**
 * Fetch a photo from a public URL (the recipe site's hero image, picked by
 * the clipper) and make it the recipe's photo. Failures are reported, not
 * thrown: a missing photo shouldn't undo a saved recipe.
 */
export async function importRecipeImage(
  db: Db,
  bucket: R2Bucket,
  recipe: RecipeImageTarget,
  imageUrl: string,
): Promise<ImportImageResult> {
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    return { ok: false, error: `"${imageUrl}" is not a valid URL.` };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "The image URL must be http(s)." };
  }
  // Only public web hosts: this fetch runs from the Worker, not the client.
  if (url.hostname === "localhost" || /^[\d.]+$|^\[/.test(url.hostname)) {
    return { ok: false, error: "The image URL must point at a public host." };
  }

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS),
      headers: { Accept: Object.keys(MIME_TO_EXT).join(", ") },
    });
  } catch (e) {
    return { ok: false, error: `Could not fetch the image: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!response.ok) {
    return { ok: false, error: `The image URL returned HTTP ${response.status}.` };
  }

  const contentType = (response.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
  if (!MIME_TO_EXT[contentType]) {
    return { ok: false, error: `The URL is not a JPEG, PNG, WebP or GIF (got "${contentType || "unknown"}").` };
  }

  const declared = Number(response.headers.get("Content-Length") ?? 0);
  if (declared > MAX_IMPORTED_IMAGE_BYTES) {
    return { ok: false, error: "The image is larger than 5MB." };
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength === 0) return { ok: false, error: "The image URL returned an empty body." };
  if (bytes.byteLength > Math.min(MAX_IMPORTED_IMAGE_BYTES, MAX_PHOTO_BYTES)) {
    return { ok: false, error: "The image is larger than 5MB." };
  }

  const { key } = await replaceRecipeImage(db, bucket, recipe, bytes, contentType);
  return { ok: true, key };
}
