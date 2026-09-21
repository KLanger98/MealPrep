import {
  index,
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export interface Ingredient {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  note?: string | null;
  category?: string | null;
}

export interface ShoppingItemSource {
  recipe: string;
  quantity: number | null;
  unit: string | null;
  scale: number;
}

const timestamps = {
  created_at: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updated_at: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString())
    .$onUpdateFn(() => new Date().toISOString()),
};

export const recipes = sqliteTable(
  "recipes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    type: text("type").notNull().default("other"),
    protein: text("protein"),
    cost: text("cost"),
    source: text("source"),
    rating: real("rating"),
    prep_minutes: integer("prep_minutes"),
    cook_minutes: integer("cook_minutes"),
    servings: integer("servings").notNull().default(1),
    tags: text("tags", { mode: "json" }).$type<string[] | null>(),
    body_markdown: text("body_markdown"),
    meta: text("meta", { mode: "json" }).$type<Record<string, unknown> | null>(),
    // The recipe's photo object in R2, so list pages never probe the bucket.
    image_key: text("image_key"),
    image_etag: text("image_etag"),
    ...timestamps,
  },
  (table) => [
    index("recipes_type_idx").on(table.type),
    index("recipes_protein_idx").on(table.protein),
    index("recipes_cost_idx").on(table.cost),
  ],
);

// One row per distinct ingredient. The name is the normalised (trimmed,
// lowercased) identity that shopping lists merge on; the category lives here
// once rather than on every recipe line.
export const ingredients = sqliteTable("ingredients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  category: text("category"),
  ...timestamps,
});

export const recipeIngredients = sqliteTable(
  "recipe_ingredients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipe_id: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    ingredient_id: integer("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    quantity: real("quantity"),
    unit: text("unit"),
    note: text("note"),
    sort_order: integer("sort_order").notNull().default(0),
  },
  (table) => [
    index("recipe_ingredients_recipe_idx").on(table.recipe_id),
    index("recipe_ingredients_ingredient_idx").on(table.ingredient_id),
  ],
);

export const mealAssignments = sqliteTable(
  "meal_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipe_id: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    slot: text("slot").notNull(),
    batch_id: text("batch_id").notNull(),
    scale_factor: real("scale_factor").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index("meal_assignments_date_idx").on(table.date),
    index("meal_assignments_batch_id_idx").on(table.batch_id),
  ],
);

export const shoppingLists = sqliteTable("shopping_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  start_date: text("start_date").notNull(),
  end_date: text("end_date").notNull(),
  ...timestamps,
});

export const shoppingListItems = sqliteTable(
  "shopping_list_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    shopping_list_id: integer("shopping_list_id")
      .notNull()
      .references(() => shoppingLists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    quantity: real("quantity"),
    unit: text("unit"),
    category: text("category").notNull().default("other"),
    sources: text("sources", { mode: "json" })
      .$type<ShoppingItemSource[]>()
      .notNull(),
    checked_at: text("checked_at"),
    sort_order: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index("shopping_list_items_list_idx").on(table.shopping_list_id),
  ],
);

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type IngredientRow = typeof ingredients.$inferSelect;
export type MealAssignment = typeof mealAssignments.$inferSelect;
export type ShoppingList = typeof shoppingLists.$inferSelect;
export type ShoppingListItem = typeof shoppingListItems.$inferSelect;
