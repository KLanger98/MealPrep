// Replaces Laravel's config/mealplan.php and config/recipes.php.

export const SLOTS = ["breakfast", "lunch", "dinner"] as const;

export const RECIPE_TYPES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "component",
  "other",
];

export const COSTS = ["low", "medium", "high"];

// Preferred short forms from recipes/SCHEMA.md, offered by the recipe form.
export const UNITS = [
  "g", "kg", "oz", "lb",
  "ml", "l", "tsp", "tbsp", "cup",
  "whole", "clove", "bunch", "can", "slice", "head", "stalk", "sprig",
  "pinch", "packet",
];

// Recipe photos live in R2 at recipes/<slug>.<ext>.
export const RECIPES_PREFIX = "recipes/";

// Checked in priority order when resolving a recipe's photo.
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];

export const CATEGORY_ORDER = [
  "produce",
  "meat",
  "seafood",
  "dairy",
  "bakery",
  "frozen",
  "pantry",
  "other",
];

// Cap on imported markdown and on the form's method text.
export const MAX_RECIPE_FILE_CHARS = 65535;

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
