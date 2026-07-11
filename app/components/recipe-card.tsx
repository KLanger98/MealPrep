import { Link } from "react-router";

export const COST_LABELS: Record<string, string> = {
  low: "$",
  medium: "$$",
  high: "$$$",
};

export interface RecipeCardData {
  slug: string;
  title: string;
  type: string;
  protein: string | null;
  cost: string | null;
  servings: number;
  tags: string[] | null;
  rating: number | null;
  total_minutes: number | null;
  image_url: string | null;
}

export function RecipeCard({ recipe }: { recipe: RecipeCardData }) {
  return (
    <Link
      to={`/recipes/${recipe.slug}`}
      className="block overflow-hidden rounded-xl border border-stone-200 bg-white transition-shadow hover:shadow-md dark:border-stone-800 dark:bg-stone-900 dark:hover:shadow-stone-900"
    >
      {recipe.image_url && (
        <img
          src={recipe.image_url}
          alt={recipe.title}
          className="h-36 w-full object-cover"
          loading="lazy"
        />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-stone-900 dark:text-stone-100">
            {recipe.title}
          </h2>
          {recipe.cost && (
            <span className="shrink-0 text-sm font-medium text-green-700 dark:text-green-400">
              {COST_LABELS[recipe.cost] ?? recipe.cost}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded-full bg-green-50 px-2 py-0.5 font-medium capitalize text-green-800 dark:bg-green-950 dark:text-green-300">
            {recipe.type}
          </span>
          {recipe.protein && (
            <span className="rounded-full bg-stone-100 px-2 py-0.5 capitalize text-stone-700 dark:bg-stone-800 dark:text-stone-300">
              {recipe.protein}
            </span>
          )}
          {(recipe.tags ?? []).map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-stone-500 dark:text-stone-400">
          <span>
            {recipe.servings} {recipe.servings === 1 ? "serving" : "servings"}
          </span>
          {recipe.total_minutes && <span>{recipe.total_minutes} min</span>}
          {recipe.rating !== null && (
            <span className="ml-auto font-medium text-amber-600 dark:text-amber-400">
              ★ {recipe.rating}/10
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
