/** Versioned URL for the recipe image resource route, or null. */
export function recipeImageUrl(
  slug: string,
  imageKey: string | null,
  imageEtag: string | null,
): string | null {
  if (imageKey === null) return null;
  return `/recipes/${slug}/image?v=${imageEtag ?? ""}`;
}
