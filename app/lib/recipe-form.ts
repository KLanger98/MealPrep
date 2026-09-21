import type { Ingredient } from "../../database/schema";
import { COSTS, MAX_RECIPE_FILE_CHARS, RECIPE_TYPES } from "./config";
import { parseQuantity } from "./quantity-parser";
import { normalizeIngredientName, type RecipeFields } from "./recipe-store";
import { slugify } from "./slug";
import { normalizeUnit } from "./unit-normalizer";

/** One ingredient row as the form holds it: every value is a raw string. */
export interface IngredientDraft {
  name: string;
  quantity: string;
  unit: string;
  note: string;
  category: string;
}

export type RecipeFormErrors = Partial<
  Record<
    "title" | "slug" | "type" | "servings" | "cost" | "prep_minutes"
    | "cook_minutes" | "ingredients" | "body_markdown",
    string
  >
>;

export type RecipeFormResult =
  | { ok: true; slug: string; fields: RecipeFields; ingredients: Ingredient[] }
  | { ok: false; errors: RecipeFormErrors };

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

/** Whole number >= min, null when blank, or "invalid". */
function wholeNumber(raw: string, min: number): number | null | "invalid" {
  if (raw === "") return null;
  if (!/^\d+$/.test(raw)) return "invalid";
  const value = parseInt(raw, 10);
  return value >= min ? value : "invalid";
}

function parseDrafts(raw: string): IngredientDraft[] | null {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(value)) return null;

    return value.map((item) => {
      const entry = (item ?? {}) as Record<string, unknown>;
      const field = (key: string) => String(entry[key] ?? "").trim();
      return {
        name: field("name"),
        quantity: field("quantity"),
        unit: field("unit"),
        note: field("note"),
        category: field("category"),
      };
    });
  } catch {
    return null;
  }
}

/**
 * Validate a submitted recipe form. `existingSlug` is set when editing: the
 * slug is the recipe's identity (URLs and photo keys hang off it), so an
 * edit can't change it.
 */
export function parseRecipeForm(
  form: FormData,
  existingSlug?: string,
): RecipeFormResult {
  const errors: RecipeFormErrors = {};

  const title = text(form, "title");
  if (title === "") errors.title = "Give the recipe a title.";

  const slug = existingSlug ?? slugify(text(form, "slug") || title);
  if (slug === "" && title !== "") {
    errors.slug = "The slug needs at least one letter or number.";
  }

  const type = text(form, "type").toLowerCase() || "other";
  if (!RECIPE_TYPES.includes(type)) errors.type = "Pick a type from the list.";

  const cost = text(form, "cost").toLowerCase() || null;
  if (cost !== null && !COSTS.includes(cost)) errors.cost = "Pick a cost from the list.";

  const servings = wholeNumber(text(form, "servings"), 1);
  if (servings === null || servings === "invalid") {
    errors.servings = "Servings must be a whole number, 1 or more.";
  }

  const prep = wholeNumber(text(form, "prep_minutes"), 0);
  if (prep === "invalid") errors.prep_minutes = "Prep time must be whole minutes.";

  const cook = wholeNumber(text(form, "cook_minutes"), 0);
  if (cook === "invalid") errors.cook_minutes = "Cook time must be whole minutes.";

  const body = text(form, "body_markdown");
  if (body.length > MAX_RECIPE_FILE_CHARS) {
    errors.body_markdown = "The method is too long.";
  }

  const ingredients: Ingredient[] = [];
  const drafts = parseDrafts(text(form, "ingredients"));

  if (drafts === null) {
    errors.ingredients = "The ingredient list could not be read.";
  } else {
    const problems: string[] = [];

    for (const draft of drafts) {
      const name = normalizeIngredientName(draft.name);

      if (name === "") {
        // A row with nothing in it is just an unused row.
        if (draft.quantity !== "" || draft.note !== "") {
          problems.push("An ingredient has a quantity or note but no name.");
        }
        continue;
      }

      const quantity = parseQuantity(draft.quantity);
      if (draft.quantity !== "" && quantity === null) {
        problems.push(
          `Can't read the quantity "${draft.quantity}" for ${name} — use a number or a fraction like 1/2.`,
        );
      }

      ingredients.push({
        name,
        quantity,
        // A unit means nothing without a quantity ("to taste" items).
        unit: quantity === null ? null : normalizeUnit(draft.unit),
        note: draft.note || null,
        category: draft.category.toLowerCase() || null,
      });
    }

    if (problems.length > 0) {
      errors.ingredients = problems.join("\n");
    } else if (ingredients.length === 0) {
      errors.ingredients = "Add at least one ingredient.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    slug,
    fields: {
      title,
      type,
      protein: text(form, "protein").toLowerCase() || null,
      cost,
      source: text(form, "source") || null,
      prep_minutes: prep as number | null,
      cook_minutes: cook as number | null,
      servings: servings as number,
      tags: text(form, "tags")
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ""),
      body_markdown: body,
    },
    ingredients,
  };
}
