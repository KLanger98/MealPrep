import { env } from "cloudflare:workers";
import { data, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/new";
import { recipes } from "../../../database/schema";
import { RecipeForm, type RecipeFormValues } from "../../components/recipe-form";
import { getDb } from "../../lib/db";
import { parseRecipeForm } from "../../lib/recipe-form";
import { probeImage } from "../../lib/recipe-images";
import { insertRecipe, listKnownIngredients } from "../../lib/recipe-store";

const BLANK: RecipeFormValues = {
  title: "",
  slug: "",
  type: "dinner",
  servings: "4",
  protein: "",
  cost: "medium",
  source: "",
  prep_minutes: "",
  cook_minutes: "",
  tags: "",
  body_markdown: "## Method\n\n1. \n\n## Notes\n\n",
  ingredients: [],
};

export function meta({}: Route.MetaArgs) {
  return [{ title: "New recipe — Meal Prep" }];
}

export async function loader({}: Route.LoaderArgs) {
  return { knownIngredients: await listKnownIngredients(getDb(env.DB)) };
}

export async function action({ request }: Route.ActionArgs) {
  const db = getDb(env.DB);
  const parsed = parseRecipeForm(await request.formData());

  if (!parsed.ok) {
    return data({ errors: parsed.errors }, 422);
  }

  const existing = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.slug, parsed.slug))
    .limit(1);

  if (existing.length > 0) {
    return data(
      { errors: { slug: `A recipe with the slug "${parsed.slug}" already exists.` } },
      422,
    );
  }

  const image = await probeImage(env.RECIPES, parsed.slug);

  await insertRecipe(db, parsed.slug, parsed.fields, parsed.ingredients, {
    image_key: image?.key ?? null,
    image_etag: image?.etag ?? null,
  });

  return redirect(`/recipes/${parsed.slug}`);
}

export default function NewRecipe() {
  const { knownIngredients } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <>
      <Link
        to="/recipes"
        className="text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
      >
        ← All recipes
      </Link>

      <h1 className="mt-2 text-2xl font-semibold">New recipe</h1>

      <RecipeForm
        initial={BLANK}
        knownIngredients={knownIngredients}
        errors={actionData?.errors}
        processing={navigation.state === "submitting"}
        submitLabel="Create recipe"
      />
    </>
  );
}
