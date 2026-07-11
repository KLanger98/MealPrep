import { eq, isNull, notInArray, and } from "drizzle-orm";
import { recipeImportErrors, recipes } from "../../database/schema";
import { IGNORED_FILES, IMAGE_EXTENSIONS, RECIPES_PREFIX } from "./config";
import type { Db } from "./db";
import { parseRecipe, RecipeParseError, type ParsedRecipe } from "./recipe-parser";

export interface SyncResult {
  created: string[];
  updated: string[];
  unchanged: string[];
  missing: string[];
  errors: Record<string, string>;
}

interface ImageRef {
  key: string;
  etag: string;
}

export function keyBasename(key: string): string {
  const file = key.slice(key.lastIndexOf("/") + 1);
  const dot = file.lastIndexOf(".");
  return dot === -1 ? file : file.slice(0, dot);
}

function keyWithoutExtension(key: string): string {
  const dot = key.lastIndexOf(".");
  const slash = key.lastIndexOf("/");
  return dot > slash ? key.slice(0, dot) : key;
}

/**
 * Resolve a frontmatter `image:` path relative to the .md object's directory.
 * Anything escaping the recipes prefix is rejected (mirrors the realpath
 * containment check in the Laravel Recipe model).
 */
export function resolveImagePath(mdKey: string, image: string): string | null {
  const dir = mdKey.slice(0, mdKey.lastIndexOf("/") + 1);
  const segments: string[] = [];

  for (const segment of `${dir}${image}`.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  const resolved = segments.join("/");
  return resolved.startsWith(RECIPES_PREFIX) ? resolved : null;
}

/**
 * Pick a recipe's image from the bucket listing: the frontmatter `image:`
 * path first, then sibling files with the same basename in extension
 * priority order.
 */
function resolveImage(
  mdKey: string,
  image: string | null,
  imagesByKey: Map<string, string>,
): ImageRef | null {
  const candidates: string[] = [];

  if (image !== null) {
    const resolved = resolveImagePath(mdKey, image);
    if (resolved !== null) candidates.push(resolved);
  }

  const base = keyWithoutExtension(mdKey);
  for (const ext of IMAGE_EXTENSIONS) {
    candidates.push(`${base}.${ext}`);
  }

  for (const candidate of candidates) {
    const etag = imagesByKey.get(candidate);
    if (etag !== undefined) return { key: candidate, etag };
  }

  return null;
}

async function listAllObjects(bucket: R2Bucket): Promise<R2Object[]> {
  const objects: R2Object[] = [];
  let cursor: string | undefined;

  do {
    const page = await bucket.list({ prefix: RECIPES_PREFIX, cursor });
    objects.push(...page.objects);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return objects;
}

async function recordError(
  db: Db,
  r2Key: string,
  message: string,
  level: "error" | "warning" = "error",
): Promise<void> {
  await db.insert(recipeImportErrors).values({ r2_key: r2Key, level, message });
}

function recipeValues(
  data: ParsedRecipe,
  r2Key: string,
  etag: string,
  image: ImageRef | null,
) {
  return {
    slug: data.slug,
    title: data.title,
    type: data.type,
    protein: data.protein,
    cost: data.cost,
    source: data.source,
    rating: data.rating,
    prep_minutes: data.prep_minutes,
    cook_minutes: data.cook_minutes,
    servings: data.servings,
    tags: data.tags,
    ingredients: data.ingredients,
    body_markdown: data.body_markdown,
    image: data.image,
    meta: data.meta,
    r2_key: r2Key,
    etag,
    image_key: image?.key ?? null,
    image_etag: image?.etag ?? null,
    missing_at: null as string | null,
    updated_at: new Date().toISOString(),
  };
}

async function upsertRecipe(
  db: Db,
  data: ParsedRecipe,
  r2Key: string,
  etag: string,
  image: ImageRef | null,
): Promise<{ wasNew: boolean }> {
  const values = recipeValues(data, r2Key, etag, image);

  const existing = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.slug, data.slug))
    .limit(1);

  if (existing.length > 0) {
    await db.update(recipes).set(values).where(eq(recipes.slug, data.slug));
    return { wasNew: false };
  }

  await db.insert(recipes).values(values);
  return { wasNew: true };
}

/**
 * Scan the recipes prefix in R2 and reconcile the database index with it.
 * Direct port of RecipeSyncer::sync(), with the R2 etag standing in for
 * file mtime + md5.
 */
export async function fullSync(
  db: Db,
  bucket: R2Bucket,
  force = false,
): Promise<SyncResult> {
  const result: SyncResult = {
    created: [],
    updated: [],
    unchanged: [],
    missing: [],
    errors: {},
  };

  const objects = await listAllObjects(bucket);

  const mdObjects = objects
    .filter((o) => o.key.endsWith(".md"))
    .filter((o) => !IGNORED_FILES.includes(o.key.slice(o.key.lastIndexOf("/") + 1)))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));

  const imagesByKey = new Map<string, string>(
    objects
      .filter((o) =>
        IMAGE_EXTENSIONS.some((ext) => o.key.toLowerCase().endsWith(`.${ext}`)),
      )
      .map((o) => [o.key, o.etag]),
  );

  await db.delete(recipeImportErrors);

  const existingRows = await db.select().from(recipes);
  const existingByKey = new Map(existingRows.map((r) => [r.r2_key, r]));

  const seenSlugs = new Map<string, string>();

  for (const obj of mdObjects) {
    const key = obj.key;
    const existing = existingByKey.get(key);

    // Unchanged file: trust the index, skip the parse (but still refresh the
    // denormalised image pointer — a photo may have been added or removed).
    if (!force && existing && existing.etag === obj.etag) {
      if (seenSlugs.has(existing.slug)) {
        await recordError(
          db,
          key,
          `Duplicate slug "${existing.slug}" (already used by ${seenSlugs.get(existing.slug)}); file skipped.`,
        );
        result.errors[key] = "duplicate slug";
        continue;
      }

      seenSlugs.set(existing.slug, key);

      const image = resolveImage(key, existing.image, imagesByKey);
      const imageChanged =
        (image?.key ?? null) !== existing.image_key ||
        (image?.etag ?? null) !== existing.image_etag;

      if (existing.missing_at !== null || imageChanged) {
        await db
          .update(recipes)
          .set({
            missing_at: null,
            image_key: image?.key ?? null,
            image_etag: image?.etag ?? null,
          })
          .where(eq(recipes.id, existing.id));
      }

      result.unchanged.push(existing.slug);
      continue;
    }

    const body = await bucket.get(key);
    if (body === null) {
      // Deleted between list() and get(); the missing pass below handles it.
      continue;
    }

    let parsed;
    try {
      parsed = parseRecipe(await body.text(), keyBasename(key));
    } catch (e) {
      if (e instanceof RecipeParseError) {
        await recordError(db, key, e.message);
        result.errors[key] = e.message;
        continue;
      }
      throw e;
    }

    const { data, warnings } = parsed;

    if (seenSlugs.has(data.slug)) {
      await recordError(
        db,
        key,
        `Duplicate slug "${data.slug}" (already used by ${seenSlugs.get(data.slug)}); file skipped.`,
      );
      result.errors[key] = "duplicate slug";
      continue;
    }

    seenSlugs.set(data.slug, key);

    for (const warning of warnings) {
      await recordError(db, key, warning, "warning");
    }

    const image = resolveImage(key, data.image, imagesByKey);
    const { wasNew } = await upsertRecipe(db, data, key, body.etag, image);

    result[wasNew ? "created" : "updated"].push(data.slug);
  }

  // Anything in the index whose file no longer exists gets flagged, not
  // deleted, so calendar assignments pointing at it keep rendering.
  const seen = [...seenSlugs.keys()];
  const missingRows = await db
    .select({ id: recipes.id, slug: recipes.slug })
    .from(recipes)
    .where(
      and(
        seen.length > 0 ? notInArray(recipes.slug, seen) : undefined,
        isNull(recipes.missing_at),
      ),
    );

  for (const row of missingRows) {
    await db
      .update(recipes)
      .set({ missing_at: new Date().toISOString() })
      .where(eq(recipes.id, row.id));
    result.missing.push(row.slug);
  }

  return result;
}

export type SyncOneResult =
  | { ok: true; slug: string; warnings: string[] }
  | { ok: false; error: string };

/**
 * Sync a single .md object after an in-app write. The content is already in
 * memory, so no listing pass is needed — just the sibling-image probe.
 */
export async function syncOne(
  db: Db,
  bucket: R2Bucket,
  key: string,
  contents: string,
  etag: string,
): Promise<SyncOneResult> {
  await db.delete(recipeImportErrors).where(eq(recipeImportErrors.r2_key, key));

  let parsed;
  try {
    parsed = parseRecipe(contents, keyBasename(key));
  } catch (e) {
    if (e instanceof RecipeParseError) {
      await recordError(db, key, e.message);
      return { ok: false, error: e.message };
    }
    throw e;
  }

  const { data, warnings } = parsed;

  // The same slug owned by a different file is a conflict, not an update.
  const bySlug = await db
    .select({ r2_key: recipes.r2_key })
    .from(recipes)
    .where(eq(recipes.slug, data.slug))
    .limit(1);

  if (bySlug.length > 0 && bySlug[0].r2_key !== key) {
    const message = `Duplicate slug "${data.slug}" (already used by ${bySlug[0].r2_key}); file skipped.`;
    await recordError(db, key, message);
    return { ok: false, error: message };
  }

  for (const warning of warnings) {
    await recordError(db, key, warning, "warning");
  }

  const image = await probeImage(bucket, key, data.image);
  await upsertRecipe(db, data, key, etag, image);

  return { ok: true, slug: data.slug, warnings };
}

/** Resolve a recipe's image with direct R2 lookups instead of a full listing. */
export async function probeImage(
  bucket: R2Bucket,
  mdKey: string,
  image: string | null,
): Promise<ImageRef | null> {
  if (image !== null) {
    const resolved = resolveImagePath(mdKey, image);
    if (resolved !== null) {
      const head = await bucket.head(resolved);
      if (head !== null) return { key: resolved, etag: head.etag };
    }
  }

  const base = keyWithoutExtension(mdKey);
  const siblings = await bucket.list({ prefix: `${base}.` });
  const byKey = new Map(siblings.objects.map((o) => [o.key, o.etag]));

  for (const ext of IMAGE_EXTENSIONS) {
    const etag = byKey.get(`${base}.${ext}`);
    if (etag !== undefined) return { key: `${base}.${ext}`, etag };
  }

  return null;
}
