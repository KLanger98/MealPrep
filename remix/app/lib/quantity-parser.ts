/**
 * Coerce a frontmatter quantity value to a number.
 *
 * Accepts numbers, numeric strings, simple fractions ("1/2") and mixed
 * numbers ("1 1/2"). Returns null for anything else — a null quantity means
 * the ingredient can't be scaled or summed.
 */
export function parseQuantity(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed !== "" && Number.isFinite(Number(trimmed))) {
    return Number(trimmed);
  }

  // Mixed number: "1 1/2"
  let m = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (m) {
    return m[3] === "0" ? null : Number(m[1]) + Number(m[2]) / Number(m[3]);
  }

  // Simple fraction: "1/2"
  m = trimmed.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (m) {
    return m[2] === "0" ? null : Number(m[1]) / Number(m[2]);
  }

  return null;
}
