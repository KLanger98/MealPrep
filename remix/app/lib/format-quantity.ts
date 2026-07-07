const FRACTIONS: Array<[number, string]> = [
  [0.25, "¼"],
  [0.33, "⅓"],
  [0.5, "½"],
  [0.66, "⅔"],
  [0.75, "¾"],
];

/**
 * Format a numeric quantity for display: trims trailing zeros, renders
 * common fractional parts as glyphs (1.5 -> "1½", 0.25 -> "¼").
 */
export function formatQuantity(quantity: number | null | undefined): string {
  if (quantity === null || quantity === undefined) return "";

  const whole = Math.floor(quantity);
  const part = quantity - whole;

  if (part > 0.01) {
    const glyph = FRACTIONS.find(([v]) => Math.abs(part - v) < 0.02)?.[1];
    if (glyph) return whole > 0 ? `${whole}${glyph}` : glyph;
  }

  const rounded = Math.round(quantity * 100) / 100;
  return String(rounded);
}

/**
 * Format quantity + unit as one label ("800 g", "1½ cup", "2 whole").
 */
export function formatAmount(
  quantity: number | null | undefined,
  unit: string | null | undefined,
): string {
  const q = formatQuantity(quantity);
  if (!q) return "";
  return unit ? `${q} ${unit}` : q;
}
