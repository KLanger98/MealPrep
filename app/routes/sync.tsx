import { env } from "cloudflare:workers";
import { data } from "react-router";
import type { Route } from "./+types/sync";
import { getDb } from "../lib/db";
import { fullSync } from "../lib/recipe-syncer";

// Resource route: full R2 -> D1 resync. Replaces both `php artisan
// recipes:sync` and the per-request sync middleware; used after bulk uploads
// straight into the bucket.
export async function action({ request }: Route.ActionArgs) {
  const url = new URL(request.url);
  const force = url.searchParams.has("force");

  const result = await fullSync(getDb(env.DB), env.RECIPES, force);

  return data(result);
}
