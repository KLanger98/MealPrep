import { parse as parseYaml } from "yaml";
import type { Ingredient } from "../../database/schema";
import { parseQuantity } from "./quantity-parser";
import { slugify } from "./slug";

export class RecipeParseError extends Error {}

/**
 * Frontmatter keys that map to their own recipe columns. Anything else is
 * preserved in the meta column so unknown/experimental keys survive.
 */
const KNOWN_KEYS = [
  "title", "slug", "type", "servings", "protein", "cost", "source",
  "rating", "prep_minutes", "cook_minutes", "tags", "ingredients", "image",
];

export interface ParsedRecipe {
  slug: string;
  title: string;
  type: string;
  protein: string | null;
  cost: string | null;
  source: string | null;
  rating: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number;
  tags: string[];
  ingredients: Ingredient[];
  image: string | null;
  body_markdown: string;
  meta: Record<string, unknown> | null;
}

export interface ParseResult {
  data: ParsedRecipe;
  warnings: string[];
}

/**
 * Split a markdown document into YAML frontmatter source and body.
 * Returns null when the document has no leading --- block.
 */
function splitFrontmatter(
  contents: string,
): { matterSource: string; body: string } | null {
  const match = contents.match(
    /^﻿?\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/,
  );

  if (!match) {
    return null;
  }

  return { matterSource: match[1], body: match[2] };
}

/**
 * Parse raw recipe markdown (a recipes/*.md R2 object or in-app editor
 * content) into recipe attributes plus non-fatal warnings.
 *
 * @throws RecipeParseError on broken YAML or a missing title
 */
export function parseRecipe(
  contents: string,
  fallbackSlugSource = "",
): ParseResult {
  const split = splitFrontmatter(contents);

  if (!split) {
    throw new RecipeParseError(
      "No YAML frontmatter found (file must start with a --- block).",
    );
  }

  let matter: unknown;

  try {
    matter = parseYaml(split.matterSource);
  } catch (e) {
    throw new RecipeParseError(
      `Invalid YAML frontmatter: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  if (
    matter === null ||
    typeof matter !== "object" ||
    Array.isArray(matter) ||
    Object.keys(matter).length === 0
  ) {
    throw new RecipeParseError(
      "No YAML frontmatter found (file must start with a --- block).",
    );
  }

  const m = matter as Record<string, unknown>;
  const warnings: string[] = [];

  const title = String(m.title ?? "").trim();

  if (title === "") {
    throw new RecipeParseError('Missing required "title" in frontmatter.');
  }

  let slug = slugify(String(m.slug ?? ""));

  if (slug === "") {
    slug = slugify(fallbackSlugSource) || slugify(title);
    warnings.push(`No slug in frontmatter; using derived slug "${slug}".`);
  }

  let servings = intOrNull(m.servings);

  if (servings === null || servings < 1) {
    warnings.push(
      'Missing or invalid "servings"; defaulting to 1 (scaling will treat the whole recipe as one serving).',
    );
    servings = 1;
  }

  const ingredients = parseIngredients(m.ingredients, warnings);

  if (ingredients.length === 0) {
    warnings.push("No ingredients listed; shopping lists will skip this recipe.");
  }

  const rawTags = m.tags;
  const tags = Array.isArray(rawTags)
    ? rawTags.map((t) => String(t).trim()).filter((t) => t !== "")
    : [];

  const meta = Object.fromEntries(
    Object.entries(m).filter(([key]) => !KNOWN_KEYS.includes(key)),
  );

  return {
    data: {
      slug,
      title,
      type: String(m.type ?? "").trim().toLowerCase() || "other",
      protein: stringOrNull(m.protein),
      cost: stringOrNull(m.cost),
      source: stringOrNull(m.source, false),
      rating: ratingOrNull(m.rating, warnings),
      prep_minutes: minutesOrNull(m.prep_minutes),
      cook_minutes: minutesOrNull(m.cook_minutes),
      servings,
      tags,
      ingredients,
      image: stringOrNull(m.image, false),
      body_markdown: split.body.trim(),
      meta: Object.keys(meta).length === 0 ? null : meta,
    },
    warnings,
  };
}

function parseIngredients(raw: unknown, warnings: string[]): Ingredient[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const ingredients: Ingredient[] = [];

  raw.forEach((item, i) => {
    // Allow a bare string ("salt") as shorthand for an unquantified item.
    if (typeof item === "string") {
      item = { name: item };
    }

    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      warnings.push(`Ingredient #${i + 1} is not a map or string; skipped.`);
      return;
    }

    const entry = item as Record<string, unknown>;
    const name = String(entry.name ?? "").trim();

    if (name === "") {
      warnings.push(`Ingredient #${i + 1} has no "name"; skipped.`);
      return;
    }

    const quantity = parseQuantity(entry.quantity ?? null);

    if ((entry.quantity ?? null) !== null && quantity === null) {
      warnings.push(
        `Ingredient "${name}" has an unreadable quantity "${entry.quantity}"; treated as unquantified.`,
      );
    }

    ingredients.push({
      name,
      quantity,
      unit: stringOrNull(entry.unit),
      note: stringOrNull(entry.note, false),
      category: stringOrNull(entry.category),
    });
  });

  return ingredients;
}

function stringOrNull(value: unknown, lowercase = true): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const str = String(value).trim();

  if (str === "") {
    return null;
  }

  return lowercase ? str.toLowerCase() : str;
}

function ratingOrNull(value: unknown, warnings: string[]): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const num =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : NaN;

  if (!Number.isFinite(num) || num < 0 || num > 10) {
    warnings.push(`Invalid rating "${value}" (must be 0–10); ignored.`);
    return null;
  }

  return Math.round(num * 10) / 10;
}

function minutesOrNull(value: unknown): number | null {
  const minutes = intOrNull(value);

  return minutes === null || minutes < 0 ? null : minutes;
}

/** PHP FILTER_VALIDATE_INT equivalent: ints or integer strings only. */
function intOrNull(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isInteger(value) ? value : null;
  }

  if (typeof value === "string" && /^\s*-?\d+\s*$/.test(value)) {
    return parseInt(value, 10);
  }

  return null;
}
