import { stringify } from "yaml";
import type { Ingredient, Recipe } from "../../database/schema";

/**
 * Render a recipe back into the SCHEMA.md file format (YAML frontmatter +
 * markdown body). The inverse of parseRecipe: used by the MCP get_recipe
 * tool, and the basis for any future export.
 */
export function recipeToMarkdown(
  recipe: Omit<Recipe, "ingredients">,
  lines: Ingredient[],
): string {
  const matter: Record<string, unknown> = {
    title: recipe.title,
    slug: recipe.slug,
    type: recipe.type,
    servings: recipe.servings,
  };

  const optional: Record<string, unknown> = {
    protein: recipe.protein,
    cost: recipe.cost,
    source: recipe.source,
    rating: recipe.rating,
    prep_minutes: recipe.prep_minutes,
    cook_minutes: recipe.cook_minutes,
  };

  for (const [key, value] of Object.entries(optional)) {
    if (value !== null && value !== undefined) matter[key] = value;
  }

  if (recipe.tags && recipe.tags.length > 0) matter.tags = recipe.tags;

  Object.assign(matter, recipe.meta ?? {});

  matter.ingredients = lines.map((line) => {
    const entry: Record<string, unknown> = { name: line.name };
    if (line.quantity !== null && line.quantity !== undefined) entry.quantity = line.quantity;
    if (line.unit) entry.unit = line.unit;
    if (line.note) entry.note = line.note;
    if (line.category) entry.category = line.category;
    return entry;
  });

  const body = (recipe.body_markdown ?? "").trim();

  return `---\n${stringify(matter)}---\n\n${body}\n`;
}
