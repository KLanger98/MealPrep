import { env } from "cloudflare:workers";
import { data } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/assignments.batch";
import { mealAssignments } from "../../database/schema";
import { SLOTS } from "../lib/config";
import { getDb } from "../lib/db";

// PATCH: update every day in a batch (scale and/or slot) in one go.
// DELETE: remove the whole batch (every day it covers).
export async function action({ request, params }: Route.ActionArgs) {
  const db = getDb(env.DB);

  if (request.method === "DELETE") {
    await db
      .delete(mealAssignments)
      .where(eq(mealAssignments.batch_id, params.batchId));
    return { ok: true };
  }

  const body = (await request.json()) as Record<string, unknown>;
  const updates: { scale_factor?: number; slot?: string } = {};

  if (body.scale_factor !== undefined) {
    const scale = Number(body.scale_factor);
    if (!Number.isFinite(scale) || scale < 0.1 || scale > 20) {
      return data({ errors: { scale_factor: "Scale must be between 0.1 and 20." } }, 422);
    }
    updates.scale_factor = scale;
  }

  if (body.slot !== undefined) {
    const slot = String(body.slot);
    if (!(SLOTS as readonly string[]).includes(slot)) {
      return data({ errors: { slot: "Pick a valid slot." } }, 422);
    }
    updates.slot = slot;
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(mealAssignments)
      .set(updates)
      .where(eq(mealAssignments.batch_id, params.batchId));
  }

  return { ok: true };
}
