import { env } from "cloudflare:workers";
import { and, asc, eq, isNull, sql, type SQL } from "drizzle-orm";
import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/index";
import { recipes } from "../../../database/schema";
import { FilterBar } from "../../components/filter-bar";
import { RecipeCard } from "../../components/recipe-card";
import { getDb } from "../../lib/db";
import { recipeImageUrl } from "../../lib/urls";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Recipes — Meal Prep" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const db = getDb(env.DB);
  const params = new URL(request.url).searchParams;

  const type = params.get("type");
  const protein = params.get("protein");
  const cost = params.get("cost");
  const tag = params.get("tag");
  const q = params.get("q");

  const conditions: (SQL | undefined)[] = [isNull(recipes.missing_at)];

  if (type) conditions.push(eq(recipes.type, type));
  if (protein) conditions.push(eq(recipes.protein, protein));
  if (cost) conditions.push(eq(recipes.cost, cost));
  if (tag) {
    conditions.push(
      sql`${recipes.tags} IS NOT NULL AND EXISTS (SELECT 1 FROM json_each(${recipes.tags}) WHERE json_each.value = ${tag})`,
    );
  }
  if (q) {
    const like = `%${q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    conditions.push(
      sql`(lower(${recipes.title}) LIKE ${like} ESCAPE '\\' OR lower(${recipes.ingredients}) LIKE ${like} ESCAPE '\\')`,
    );
  }

  const rows = await db
    .select()
    .from(recipes)
    .where(and(...conditions))
    .orderBy(asc(recipes.title));

  // Filter dropdown options come from all available recipes, not the
  // filtered set (matches the Laravel controller).
  const available = await db
    .select({
      type: recipes.type,
      protein: recipes.protein,
      cost: recipes.cost,
      tags: recipes.tags,
    })
    .from(recipes)
    .where(isNull(recipes.missing_at));

  const distinct = (values: (string | null)[]) =>
    [...new Set(values.filter((v): v is string => v !== null))].sort();

  return {
    recipes: rows.map((recipe) => ({
      slug: recipe.slug,
      title: recipe.title,
      type: recipe.type,
      protein: recipe.protein,
      cost: recipe.cost,
      servings: recipe.servings,
      tags: recipe.tags,
      rating: recipe.rating,
      total_minutes:
        (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0) || null,
      image_url: recipeImageUrl(recipe.slug, recipe.image_key, recipe.image_etag),
    })),
    filterOptions: {
      types: distinct(available.map((r) => r.type)),
      proteins: distinct(available.map((r) => r.protein)),
      costs: distinct(available.map((r) => r.cost)),
      tags: distinct(available.flatMap((r) => r.tags ?? [])),
    },
  };
}

export default function RecipesIndex() {
  const { recipes, filterOptions } = useLoaderData<typeof loader>();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Recipes</h1>
          <Link
            to="/recipes/new"
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >
            + New recipe
          </Link>
        </div>
        <FilterBar options={filterOptions} />
      </div>

      {recipes.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.slug} recipe={recipe} />
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center text-stone-500 dark:text-stone-400">
          <p className="text-lg font-medium">No recipes found</p>
          <p className="mt-1 text-sm">
            Drop a <span className="font-mono">.md</span> file into the recipes
            bucket (see <span className="font-mono">recipes/SCHEMA.md</span>)
            and resync.
          </p>
        </div>
      )}
    </>
  );
}
