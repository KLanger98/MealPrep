import { env } from "cloudflare:workers";
import {
  data,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/edit";
import { recipes } from "../../../database/schema";
import { RecipeForm, type RecipeFormValues } from "../../components/recipe-form";
import { getDb } from "../../lib/db";
import { parseRecipeForm } from "../../lib/recipe-form";
import {
  listKnownIngredients,
  loadIngredients,
  updateRecipe,
} from "../../lib/recipe-store";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Edit — ${loaderData?.initial.title ?? "Recipe"} — Meal Prep` }];
}

async function findRecipe(slug: string) {
  const rows = await getDb(env.DB)
    .select()
    .from(recipes)
    .where(eq(recipes.slug, slug))
    .limit(1);

  if (!rows[0]) throw data(null, 404);
  return rows[0];
}

export async function loader({ params }: Route.LoaderArgs) {
  const db = getDb(env.DB);
  const recipe = await findRecipe(params.slug);
  const lines = await loadIngredients(db, recipe.id);

  const initial: RecipeFormValues = {
    title: recipe.title,
    slug: recipe.slug,
    type: recipe.type,
    servings: String(recipe.servings),
    protein: recipe.protein ?? "",
    cost: recipe.cost ?? "",
    source: recipe.source ?? "",
    prep_minutes: recipe.prep_minutes?.toString() ?? "",
    cook_minutes: recipe.cook_minutes?.toString() ?? "",
    tags: (recipe.tags ?? []).join(", "),
    body_markdown: recipe.body_markdown ?? "",
    ingredients: lines.map((line) => ({
      name: line.name,
      quantity: line.quantity?.toString() ?? "",
      unit: line.unit ?? "",
      note: line.note ?? "",
      category: line.category ?? "",
    })),
  };

  return {
    slug: recipe.slug,
    initial,
    knownIngredients: await listKnownIngredients(db),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const recipe = await findRecipe(params.slug);
  const parsed = parseRecipeForm(await request.formData(), recipe.slug);

  if (!parsed.ok) {
    return data({ errors: parsed.errors }, 422);
  }

  await updateRecipe(getDb(env.DB), recipe.slug, parsed.fields, parsed.ingredients);

  return redirect(`/recipes/${recipe.slug}`);
}

export default function EditRecipe() {
  const { slug, initial, knownIngredients } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <>
      <Link
        to={`/recipes/${slug}`}
        className="text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
      >
        ← {initial.title}
      </Link>

      <h1 className="mt-2 text-2xl font-semibold">Edit {initial.title}</h1>

      <RecipeForm
        initial={initial}
        knownIngredients={knownIngredients}
        errors={actionData?.errors}
        editingSlug={slug}
        processing={navigation.state === "submitting"}
        submitLabel="Save changes"
      />
    </>
  );
}
