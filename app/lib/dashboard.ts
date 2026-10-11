import { asc, desc, eq, sql } from "drizzle-orm";
import { mealAssignments, recipes } from "../../database/schema";
import type { RecipeCardData } from "../components/recipe-card";
import { SLOTS } from "./config";
import type { Db } from "./db";
import { loadPeopleFor, type PersonOption } from "./people";
import { recipeImageUrl } from "./urls";

export const RECENT_RECIPE_COUNT = 6;

export interface TodayMeal {
  id: number;
  slot: string;
  scale_factor: number;
  recipe: {
    slug: string;
    title: string;
    servings: number;
    total_minutes: number | null;
    image_url: string | null;
  };
  people: PersonOption[];
}

export interface Dashboard {
  date: string;
  meals: TodayMeal[];
  recentRecipes: RecipeCardData[];
}

const slotRank = (slot: string) => {
  const rank = (SLOTS as readonly string[]).indexOf(slot);
  return rank === -1 ? SLOTS.length : rank;
};

const totalMinutes = (recipe: { prep_minutes: number | null; cook_minutes: number | null }) =>
  (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0) || null;

/** What's planned for `date` (in slot order) and the newest recipes. */
export async function loadDashboard(db: Db, date: string): Promise<Dashboard> {
  const rows = await db
    .select({ assignment: mealAssignments, recipe: recipes })
    .from(mealAssignments)
    .innerJoin(recipes, eq(mealAssignments.recipe_id, recipes.id))
    .where(eq(mealAssignments.date, date))
    .orderBy(asc(mealAssignments.id));

  const peopleByAssignment = await loadPeopleFor(
    db,
    rows.map((row) => row.assignment.id),
  );

  const meals = rows
    .map(({ assignment, recipe }): TodayMeal => ({
      id: assignment.id,
      slot: assignment.slot,
      scale_factor: assignment.scale_factor,
      recipe: {
        slug: recipe.slug,
        title: recipe.title,
        servings: recipe.servings,
        total_minutes: totalMinutes(recipe),
        image_url: recipeImageUrl(recipe.slug, recipe.image_key, recipe.image_etag),
      },
      people: peopleByAssignment.get(assignment.id) ?? [],
    }))
    .sort((a, b) => slotRank(a.slot) - slotRank(b.slot));

  // Same derivation as the recipes index: one batch counts once, once its
  // first day has arrived.
  const cooked = sql<number>`(
    SELECT count(DISTINCT batch_id) FROM meal_assignments
    WHERE recipe_id = recipes.id AND date <= ${date}
  )`;

  const recent = await db
    .select({ recipe: recipes, cooked })
    .from(recipes)
    .orderBy(desc(recipes.created_at), desc(recipes.id))
    .limit(RECENT_RECIPE_COUNT);

  return {
    date,
    meals,
    recentRecipes: recent.map(({ recipe, cooked }) => ({
      cooked: Number(cooked),
      slug: recipe.slug,
      title: recipe.title,
      type: recipe.type,
      protein: recipe.protein,
      cost: recipe.cost,
      servings: recipe.servings,
      tags: recipe.tags,
      rating: recipe.rating,
      total_minutes: totalMinutes(recipe),
      image_url: recipeImageUrl(recipe.slug, recipe.image_key, recipe.image_etag),
    })),
  };
}
