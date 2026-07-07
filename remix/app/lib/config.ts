// Replaces Laravel's config/mealplan.php and config/recipes.php.

export const SLOTS = ["breakfast", "lunch", "dinner"] as const;

export const RECIPES_PREFIX = "recipes/";

export const IGNORED_FILES = ["SCHEMA.md", "README.md"];

// Checked in priority order when resolving a recipe's sibling photo.
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

export const MAX_RECIPE_FILE_CHARS = 65535;

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
