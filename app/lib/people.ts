import { asc, eq, inArray, sql } from "drizzle-orm";
import { mealAssignmentPeople, mealAssignments, people } from "../../database/schema";
import type { Db } from "./db";

export interface PersonOption {
  id: number;
  name: string;
}

export const MAX_PERSON_NAME_CHARS = 40;

export async function listPeople(db: Db): Promise<PersonOption[]> {
  return db
    .select({ id: people.id, name: people.name })
    .from(people)
    .orderBy(asc(people.name));
}

/**
 * Validate a submitted `person_ids` value: an array of ids that all exist.
 * Returns the de-duplicated ids, or an error message.
 */
export async function parsePersonIds(
  db: Db,
  raw: unknown,
): Promise<{ ids: number[] } | { error: string }> {
  if (raw === undefined || raw === null) return { ids: [] };

  if (!Array.isArray(raw) || !raw.every((id) => Number.isInteger(id))) {
    return { error: "Pick people from the list." };
  }

  const ids = [...new Set(raw as number[])];
  if (ids.length === 0) return { ids };

  const found = await db
    .select({ id: people.id })
    .from(people)
    .where(inArray(people.id, ids));

  if (found.length !== ids.length) {
    return { error: "One of those people no longer exists." };
  }

  return { ids };
}

/**
 * Statements that make `personIds` the people for every day of a batch.
 * Written as INSERT … SELECT over the batch so they can share one atomic D1
 * batch with the statements that create or update the days themselves.
 */
export function setBatchPeopleStatements(db: Db, batchId: string, personIds: number[]) {
  const batchDays = db
    .select({ id: mealAssignments.id })
    .from(mealAssignments)
    .where(eq(mealAssignments.batch_id, batchId));

  const clear = db
    .delete(mealAssignmentPeople)
    .where(inArray(mealAssignmentPeople.assignment_id, batchDays));

  const inserts = personIds.map((personId) =>
    db.insert(mealAssignmentPeople).select(
      db
        .select({
          assignment_id: mealAssignments.id,
          person_id: sql<number>`${personId}`.as("person_id"),
        })
        .from(mealAssignments)
        .where(eq(mealAssignments.batch_id, batchId)),
    ),
  );

  return [clear, ...inserts];
}

/** People per assignment id, names in alphabetical order. */
export async function loadPeopleFor(
  db: Db,
  assignmentIds: number[],
): Promise<Map<number, PersonOption[]>> {
  const byAssignment = new Map<number, PersonOption[]>();
  if (assignmentIds.length === 0) return byAssignment;

  const rows = await db
    .select({
      assignment_id: mealAssignmentPeople.assignment_id,
      id: people.id,
      name: people.name,
    })
    .from(mealAssignmentPeople)
    .innerJoin(people, eq(mealAssignmentPeople.person_id, people.id))
    .where(inArray(mealAssignmentPeople.assignment_id, assignmentIds))
    .orderBy(asc(people.name));

  for (const { assignment_id, ...person } of rows) {
    const list = byAssignment.get(assignment_id) ?? [];
    list.push(person);
    byAssignment.set(assignment_id, list);
  }

  return byAssignment;
}
