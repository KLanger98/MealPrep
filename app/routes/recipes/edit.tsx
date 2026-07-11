import { env } from "cloudflare:workers";
import { useState } from "react";
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
import { RecipeFileEditor } from "../../components/recipe-file-editor";
import { MAX_RECIPE_FILE_CHARS } from "../../lib/config";
import { getDb } from "../../lib/db";
import { parseRecipe, RecipeParseError } from "../../lib/recipe-parser";
import { syncOne } from "../../lib/recipe-syncer";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `Edit — ${loaderData?.recipe.title ?? "Recipe"} — Meal Prep` }];
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
  const recipe = await findRecipe(params.slug);
  const object = await env.RECIPES.get(recipe.r2_key);

  if (object === null) {
    // The file is missing — nothing to edit until it's restored.
    throw redirect(`/recipes/${recipe.slug}`);
  }

  return {
    recipe: { slug: recipe.slug, title: recipe.title, file: recipe.r2_key },
    content: await object.text(),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const db = getDb(env.DB);
  const recipe = await findRecipe(params.slug);

  const form = await request.formData();
  const content = form.get("content");

  if (typeof content !== "string" || content.length === 0) {
    return data({ errors: { content: "The recipe file can't be empty." } }, 422);
  }
  if (content.length > MAX_RECIPE_FILE_CHARS) {
    return data({ errors: { content: "The recipe file is too large." } }, 422);
  }

  let parsed;
  try {
    parsed = parseRecipe(content, recipe.slug);
  } catch (e) {
    if (e instanceof RecipeParseError) {
      return data({ errors: { content: e.message } }, 422);
    }
    throw e;
  }

  // The slug is the recipe's identity — calendar assignments point at it.
  if (parsed.data.slug !== recipe.slug) {
    return data(
      {
        errors: {
          content: `The slug can't be changed here (calendar assignments reference "${recipe.slug}"). Keep slug: ${recipe.slug}`,
        },
      },
      422,
    );
  }

  const object = await env.RECIPES.put(recipe.r2_key, content, {
    httpMetadata: { contentType: "text/markdown" },
  });
  await syncOne(db, env.RECIPES, recipe.r2_key, content, object!.etag);

  return redirect(`/recipes/${recipe.slug}`);
}

export default function EditRecipe() {
  const { recipe, content: initialContent } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [content, setContent] = useState(initialContent);

  return (
    <>
      <Link
        to={`/recipes/${recipe.slug}`}
        className="text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
      >
        ← {recipe.title}
      </Link>

      <h1 className="mt-2 text-2xl font-semibold">Edit {recipe.title}</h1>
      <p
        className="mt-1 truncate text-sm text-stone-500 dark:text-stone-400"
        title={recipe.file}
      >
        Editing <span className="font-mono">{recipe.file}</span>
      </p>

      <RecipeFileEditor
        content={content}
        onChange={setContent}
        error={actionData?.errors?.content}
        processing={navigation.state === "submitting"}
        submitLabel="Save changes"
      />
    </>
  );
}
