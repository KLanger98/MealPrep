import { env } from "cloudflare:workers";
import { useState } from "react";
import { data, Link, redirect, useActionData, useNavigation } from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/new";
import { recipes } from "../../../database/schema";
import { RecipeFileEditor } from "../../components/recipe-file-editor";
import { MAX_RECIPE_FILE_CHARS, RECIPES_PREFIX } from "../../lib/config";
import { getDb } from "../../lib/db";
import { parseRecipe, RecipeParseError } from "../../lib/recipe-parser";
import { syncOne } from "../../lib/recipe-syncer";

const TEMPLATE = `---
title:
slug:
type: dinner
servings: 4
protein:
cost: medium
source:
prep_minutes:
cook_minutes:
tags: []
ingredients:
  - name:
    quantity:
    unit: g
    category:
---

## Method

1.

## Notes

`;

export function meta({}: Route.MetaArgs) {
  return [{ title: "New recipe — Meal Prep" }];
}

export async function action({ request }: Route.ActionArgs) {
  const db = getDb(env.DB);
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
    parsed = parseRecipe(content);
  } catch (e) {
    if (e instanceof RecipeParseError) {
      return data({ errors: { content: e.message } }, 422);
    }
    throw e;
  }

  const slug = parsed.data.slug;
  const key = `${RECIPES_PREFIX}${slug}.md`;

  const existing = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.slug, slug))
    .limit(1);

  if (existing.length > 0 || (await env.RECIPES.head(key)) !== null) {
    return data(
      { errors: { content: `A recipe with the slug "${slug}" already exists.` } },
      422,
    );
  }

  const object = await env.RECIPES.put(key, content, {
    httpMetadata: { contentType: "text/markdown" },
  });
  await syncOne(db, env.RECIPES, key, content, object!.etag);

  return redirect(`/recipes/${slug}`);
}

export default function NewRecipe() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [content, setContent] = useState(TEMPLATE);

  return (
    <>
      <Link
        to="/recipes"
        className="text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
      >
        ← All recipes
      </Link>

      <h1 className="mt-2 text-2xl font-semibold">New recipe</h1>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        This creates a <span className="font-mono">.md</span> file in your
        recipes bucket — the same thing an AI (or you, in a text editor) would
        write.
      </p>

      <RecipeFileEditor
        content={content}
        onChange={setContent}
        error={actionData?.errors?.content}
        processing={navigation.state === "submitting"}
        submitLabel="Create recipe"
      />
    </>
  );
}
