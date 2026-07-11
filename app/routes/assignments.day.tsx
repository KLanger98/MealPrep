import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/assignments.day";
import { mealAssignments } from "../../database/schema";
import { getDb } from "../lib/db";

// DELETE /assignments/:id — remove a single day from a batch.
export async function action({ params }: Route.ActionArgs) {
  await getDb(env.DB)
    .delete(mealAssignments)
    .where(eq(mealAssignments.id, Number(params.id)));

  return { ok: true };
}
