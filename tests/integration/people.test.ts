import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  mealAssignmentPeople,
  mealAssignments,
  people,
  recipes,
} from "../../database/schema";
import { getDb } from "../../app/lib/db";
import {
  loadPeopleFor,
  parsePersonIds,
  setBatchPeopleStatements,
} from "../../app/lib/people";

const db = getDb(env.DB);

async function person(name: string): Promise<number> {
  const [row] = await db.insert(people).values({ name }).returning({ id: people.id });
  return row.id;
}

/** A batch of `days` assignments for a throwaway recipe; returns their ids. */
async function batch(batchId: string, days: string[]): Promise<number[]> {
  const existing = await db.select({ id: recipes.id }).from(recipes).limit(1);
  const recipeId =
    existing[0]?.id ??
    (
      await db
        .insert(recipes)
        .values({ slug: "tacos", title: "Tacos", servings: 2 })
        .returning({ id: recipes.id })
    )[0].id;

  const rows = await db
    .insert(mealAssignments)
    .values(days.map((date) => ({ recipe_id: recipeId, date, slot: "dinner", batch_id: batchId })))
    .returning({ id: mealAssignments.id });

  return rows.map((row) => row.id);
}

async function setPeople(batchId: string, ids: number[]) {
  const statements = setBatchPeopleStatements(db, batchId, ids);
  await db.batch(statements as unknown as [(typeof statements)[number]]);
}

describe("people on meals", () => {
  it("assigns people to every day of a batch and replaces them on edit", async () => {
    const [karl, sam, alex] = [await person("Karl"), await person("Sam"), await person("Alex")];
    const days = await batch("b1", ["2026-09-21", "2026-09-22"]);
    const [other] = await batch("b2", ["2026-09-21"]);

    await setPeople("b1", [karl, sam]);

    let byDay = await loadPeopleFor(db, [...days, other]);
    expect(byDay.get(days[0])?.map((p) => p.name)).toEqual(["Karl", "Sam"]);
    expect(byDay.get(days[1])?.map((p) => p.name)).toEqual(["Karl", "Sam"]);
    expect(byDay.get(other)).toBeUndefined();

    await setPeople("b1", [alex]);

    byDay = await loadPeopleFor(db, days);
    expect(byDay.get(days[0])?.map((p) => p.name)).toEqual(["Alex"]);
    expect(await db.select().from(mealAssignmentPeople)).toHaveLength(2);
  });

  it("cleans up when a day or a person is removed", async () => {
    const [karl, sam] = [await person("Karl"), await person("Sam")];
    const days = await batch("b1", ["2026-09-21", "2026-09-22"]);
    await setPeople("b1", [karl, sam]);

    await db.delete(mealAssignments).where(eq(mealAssignments.id, days[0]));
    expect(await db.select().from(mealAssignmentPeople)).toHaveLength(2);

    await db.delete(people).where(eq(people.id, sam));
    const left = await loadPeopleFor(db, days);
    expect(left.get(days[1])?.map((p) => p.name)).toEqual(["Karl"]);
    // The meal itself survives losing a person.
    expect(await db.select().from(mealAssignments)).toHaveLength(1);
  });

  it("validates submitted person ids", async () => {
    const karl = await person("Karl");

    expect(await parsePersonIds(db, undefined)).toEqual({ ids: [] });
    expect(await parsePersonIds(db, [karl, karl])).toEqual({ ids: [karl] });
    expect(await parsePersonIds(db, "karl")).toHaveProperty("error");
    expect(await parsePersonIds(db, [karl, 9999])).toHaveProperty("error");
  });
});
