import { IMAGE_EXTENSIONS, RECIPES_PREFIX } from "./config";

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
