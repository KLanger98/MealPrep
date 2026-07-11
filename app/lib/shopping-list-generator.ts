import { and, asc, eq, gte, isNotNull, lte } from "drizzle-orm";
import type { Ingredient, ShoppingItemSource, ShoppingList } from "../../database/schema";
import {
  mealAssignments,
  recipes,
  shoppingListItems,
} from "../../database/schema";
import { CATEGORY_ORDER } from "./config";
import type { Db } from "./db";
import { canonicalize, humanize } from "./unit-normalizer";

export interface BatchInput {
  recipe: { title: string; ingredients: Ingredient[] };
  scaleFactor: number;
}

export interface MergedLine {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  sources: ShoppingItemSource[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Explode every batch's ingredients (scaled), then merge lines that share a
 * normalized name + canonical unit. Unquantified items merge into a single
 * unquantified line per name.
 */
export function mergeIngredients(batches: BatchInput[]): MergedLine[] {
  const lines = new Map<
    string,
    {
      name: string;
      quantity: number | null;
      unit: string | null;
      category: string | null;
      sources: ShoppingItemSource[];
    }
  >();

  for (const { recipe, scaleFactor } of batches) {
    for (const ingredient of recipe.ingredients) {
      const name = ingredient.name.trim().toLowerCase();
      const rawQuantity = ingredient.quantity ?? null;

      let quantity: number | null;
      let unit: string | null;

      if (rawQuantity === null) {
        quantity = null;
        unit = null;
      } else {
        [quantity, unit] = canonicalize(
          rawQuantity * scaleFactor,
          ingredient.unit ?? null,
        );
      }

      const key = `${name}|${quantity === null ? "" : (unit ?? "")}`;

      let line = lines.get(key);
      if (!line) {
        line = {
          name,
          quantity: null,
          unit,
          category: ingredient.category ?? null,
          sources: [],
        };
        lines.set(key, line);
      }

      if (quantity !== null) {
        line.quantity = (line.quantity ?? 0) + quantity;
      }

      line.category ??= ingredient.category ?? null;
      line.sources.push({
        recipe: recipe.title,
        quantity: rawQuantity === null ? null : round2(rawQuantity * scaleFactor),
        unit: ingredient.unit ?? null,
        scale: scaleFactor,
      });
    }
  }

  const merged: MergedLine[] = [...lines.values()].map((line) => {
    let { quantity, unit } = line;

    if (quantity !== null) {
      [quantity, unit] = humanize(quantity, unit);
      quantity = round2(quantity);
    }

    return { ...line, quantity, unit, category: line.category ?? "other" };
  });

  merged.sort((a, b) => {
    const catA = CATEGORY_ORDER.indexOf(a.category);
    const catB = CATEGORY_ORDER.indexOf(b.category);
    const orderA = catA === -1 ? Number.MAX_SAFE_INTEGER : catA;
    const orderB = catB === -1 ? Number.MAX_SAFE_INTEGER : catB;

    if (orderA !== orderB) return orderA - orderB;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  return merged;
}

/**
 * Build (or rebuild) the items for a shopping list from every batch whose
 * days overlap the list's date range.
 *
 * A batch (one cook of a recipe, possibly eaten across several days) is
 * counted exactly once, even if only some of its days fall in the range —
 * you still cook the whole thing.
 */
export async function generate(db: Db, list: ShoppingList): Promise<void> {
  const rows = await db
    .select({
      batchId: mealAssignments.batch_id,
      scaleFactor: mealAssignments.scale_factor,
      title: recipes.title,
      ingredients: recipes.ingredients,
    })
    .from(mealAssignments)
    .innerJoin(recipes, eq(mealAssignments.recipe_id, recipes.id))
    .where(
      and(
        gte(mealAssignments.date, list.start_date),
        lte(mealAssignments.date, list.end_date),
      ),
    )
    .orderBy(asc(mealAssignments.id));

  const seenBatches = new Set<string>();
  const batches: BatchInput[] = [];

  for (const row of rows) {
    if (seenBatches.has(row.batchId)) continue;
    seenBatches.add(row.batchId);
    batches.push({
      recipe: { title: row.title, ingredients: row.ingredients },
      scaleFactor: row.scaleFactor,
    });
  }

  const merged = mergeIngredients(batches);

  // Preserve check state across regenerations by matching name + unit.
  const checkedRows = await db
    .select({
      name: shoppingListItems.name,
      unit: shoppingListItems.unit,
      checked_at: shoppingListItems.checked_at,
    })
    .from(shoppingListItems)
    .where(
      and(
        eq(shoppingListItems.shopping_list_id, list.id),
        isNotNull(shoppingListItems.checked_at),
      ),
    );

  const previouslyChecked = new Map(
    checkedRows.map((item) => [`${item.name}|${item.unit ?? ""}`, item.checked_at]),
  );

  const deleteOld = db
    .delete(shoppingListItems)
    .where(eq(shoppingListItems.shopping_list_id, list.id));

  const inserts = merged.map((item, sortOrder) =>
    db.insert(shoppingListItems).values({
      shopping_list_id: list.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      sources: item.sources,
      checked_at:
        previouslyChecked.get(`${item.name}|${item.unit ?? ""}`) ?? null,
      sort_order: sortOrder,
    }),
  );

  // D1 has no interactive transactions; a batch is atomic.
  await db.batch([deleteOld, ...inserts] as [typeof deleteOld]);
}
