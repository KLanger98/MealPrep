import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { mealAssignmentPeople, mealAssignments, people, recipes } from "../../database/schema";
import { getDb } from "../../app/lib/db";
import { loadDashboard, RECENT_RECIPE_COUNT } from "../../app/lib/dashboard";

const db = getDb(env.DB);

async function recipe(slug: string, createdAt: string): Promise<number> {
  const [row] = await db
    .insert(recipes)
    .values({ slug, title: slug, servings: 2, created_at: createdAt })
    .returning({ id: recipes.id });
  return row.id;
}

describe("loadDashboard", () => {
  it("lists only the given day's meals, in slot order, with people", async () => {
    const soup = await recipe("soup", "2026-01-01T00:00:00Z");
    const oats = await recipe("oats", "2026-01-02T00:00:00Z");

    const [dinner] = await db
      .insert(mealAssignments)
      .values([
        { recipe_id: soup, date: "2026-10-11", slot: "dinner", batch_id: "a" },
        { recipe_id: oats, date: "2026-10-11", slot: "breakfast", batch_id: "b" },
        { recipe_id: soup, date: "2026-10-12", slot: "dinner", batch_id: "a" },
      ])
      .returning({ id: mealAssignments.id });
    const [sam] = await db.insert(people).values({ name: "Sam" }).returning({ id: people.id });
    await db.insert(mealAssignmentPeople).values({ assignment_id: dinner.id, person_id: sam.id });

    const { meals } = await loadDashboard(db, "2026-10-11");

    expect(meals.map((m) => [m.slot, m.recipe.slug])).toEqual([
      ["breakfast", "oats"],
      ["dinner", "soup"],
    ]);
    expect(meals[1].people.map((p) => p.name)).toEqual(["Sam"]);
  });

  it("returns the newest recipes first, capped", async () => {
    for (let i = 1; i <= RECENT_RECIPE_COUNT + 2; i++) {
      await recipe(`r${i}`, `2026-02-${String(i).padStart(2, "0")}T00:00:00Z`);
    }

    const { recentRecipes } = await loadDashboard(db, "2026-10-11");

    expect(recentRecipes).toHaveLength(RECENT_RECIPE_COUNT);
    expect(recentRecipes[0].slug).toBe(`r${RECENT_RECIPE_COUNT + 2}`);
  });
});
