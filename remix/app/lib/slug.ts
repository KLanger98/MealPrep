/**
 * ASCII slug matching Laravel's Str::slug behaviour for the inputs this app
 * sees: lowercase, non-alphanumeric runs collapse to single dashes, trimmed.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
