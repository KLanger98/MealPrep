import { env } from "cloudflare:workers";
import { data } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/assignments";
import { mealAssignments, recipes } from "../../database/schema";
import { SLOTS } from "../lib/config";
import { eachDay, isValidDate } from "../lib/dates";
import { getDb } from "../lib/db";

// POST /assignments — assign a recipe to a slot across a date range: one row
// per day, linked by a shared batch_id (a batch = one cook of the recipe).
// Port of StoreMealAssignmentRequest + MealAssignmentController::store().
export async function action({ request }: Route.ActionArgs) {
  const db = getDb(env.DB);
  const body = (await request.json()) as Record<string, unknown>;

  const recipeId = Number(body.recipe_id);
  const slot = String(body.slot ?? "");
  const startDate = String(body.start_date ?? "");
  const endDate = String(body.end_date ?? "");
  const scaleFactor = Number(body.scale_factor);

  const errors: Record<string, string> = {};

  if (!Number.isInteger(recipeId)) {
    errors.recipe_id = "Pick a recipe.";
  } else {
    const exists = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.id, recipeId))
      .limit(1);
    if (exists.length === 0) errors.recipe_id = "That recipe no longer exists.";
  }

  if (!(SLOTS as readonly string[]).includes(slot)) errors.slot = "Pick a valid slot.";
  if (!isValidDate(startDate)) errors.start_date = "Pick a start date.";
  if (!isValidDate(endDate)) {
    errors.end_date = "Pick an end date.";
  } else if (isValidDate(startDate) && endDate < startDate) {
    errors.end_date = "The end date must be on or after the start date.";
  }
  if (!Number.isFinite(scaleFactor) || scaleFactor < 0.1 || scaleFactor > 20) {
    errors.scale_factor = "Scale must be between 0.1 and 20.";
  }

  if (Object.keys(errors).length > 0) {
    return data({ errors }, 422);
  }

  const batchId = crypto.randomUUID();
  const inserts = eachDay(startDate, endDate).map((date) =>
    db.insert(mealAssignments).values({
      recipe_id: recipeId,
      date,
      slot,
      batch_id: batchId,
      scale_factor: scaleFactor,
    }),
  );

  await db.batch(inserts as [(typeof inserts)[number]]);

  return { ok: true };
}
