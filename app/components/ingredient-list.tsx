import type { Ingredient } from "../../database/schema";
import { formatAmount } from "../lib/format-quantity";

function scaledAmount(ingredient: Ingredient, scale: number): string {
  if (ingredient.quantity === null || ingredient.quantity === undefined) return "";
  return formatAmount(ingredient.quantity * scale, ingredient.unit);
}

export function IngredientList({
  ingredients,
  scale = 1,
  className = "",
}: {
  ingredients: Ingredient[];
  scale?: number;
  className?: string;
}) {
  return (
    <ul className={`divide-y divide-stone-100 dark:divide-stone-800 ${className}`}>
      {ingredients.map((ingredient, i) => {
        const amount = scaledAmount(ingredient, scale);
        return (
          <li key={i} className="flex items-baseline gap-2 py-1.5">
            <span
              className={`min-w-20 shrink-0 font-medium tabular-nums ${
                amount ? "" : "text-stone-400 dark:text-stone-500"
              }`}
            >
              {amount || "—"}
            </span>
            <span>
              {ingredient.name}
              {ingredient.note && (
                <span className="text-sm text-stone-500 dark:text-stone-400">
                  {" "}({ingredient.note})
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
