import { applyD1Migrations, env } from "cloudflare:test";
import { beforeEach } from "vitest";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

// vitest-pool-workers 0.18 no longer isolates storage per test, so reset the
// database and bucket by hand between tests.
beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM shopping_list_items"),
    env.DB.prepare("DELETE FROM shopping_lists"),
    env.DB.prepare("DELETE FROM meal_assignments"),
    env.DB.prepare("DELETE FROM recipe_import_errors"),
    env.DB.prepare("DELETE FROM recipes"),
  ]);

  let cursor: string | undefined;
  do {
    const page = await env.RECIPES.list({ cursor });
    if (page.objects.length > 0) {
      await env.RECIPES.delete(page.objects.map((o) => o.key));
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
});
