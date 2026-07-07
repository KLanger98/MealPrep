/**
 * Alias map from common spellings to a canonical unit token.
 */
const ALIASES: Record<string, string> = {
  g: "g", gram: "g", grams: "g", gr: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg", kilo: "kg", kilos: "kg",
  ml: "ml", milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  l: "l", liter: "l", liters: "l", litre: "l", litres: "l",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp",
  cup: "cup", cups: "cup",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  whole: "whole", each: "whole", x: "whole", piece: "whole", pieces: "whole",
  bunch: "bunch", bunches: "bunch",
  clove: "clove", cloves: "clove",
  can: "can", cans: "can", tin: "can", tins: "can",
  slice: "slice", slices: "slice",
  head: "head", heads: "head",
  stalk: "stalk", stalks: "stalk",
  sprig: "sprig", sprigs: "sprig",
  pinch: "pinch", pinches: "pinch",
  packet: "packet", packets: "packet", pack: "packet", packs: "packet",
};

/**
 * Units convertible to a smaller base unit for merging: unit => [base, factor].
 */
const CONVERSIONS: Record<string, [string, number]> = {
  kg: ["g", 1000],
  l: ["ml", 1000],
};

/**
 * Normalize a raw unit string to its canonical token.
 * Unknown units pass through lowercased/trimmed rather than being rejected.
 */
export function normalizeUnit(unit: string | null | undefined): string | null {
  if (unit === null || unit === undefined) {
    return null;
  }

  const key = unit.trim().toLowerCase();

  if (key === "") {
    return null;
  }

  return ALIASES[key] ?? key;
}

/**
 * Convert a quantity to its canonical base unit so g/kg and ml/l merge.
 */
export function canonicalize(
  quantity: number,
  unit: string | null | undefined,
): [number, string | null] {
  const normalized = normalizeUnit(unit);

  if (normalized !== null && normalized in CONVERSIONS) {
    const [base, factor] = CONVERSIONS[normalized];
    return [quantity * factor, base];
  }

  return [quantity, normalized];
}

/**
 * Present a canonical quantity in a friendly unit (1500 g -> 1.5 kg).
 */
export function humanize(
  quantity: number,
  unit: string | null,
): [number, string | null] {
  for (const [big, [base, factor]] of Object.entries(CONVERSIONS)) {
    if (unit === base && quantity >= factor) {
      return [quantity / factor, big];
    }
  }

  return [quantity, unit];
}
