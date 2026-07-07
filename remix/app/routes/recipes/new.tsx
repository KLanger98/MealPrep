import { env } from "cloudflare:workers";
import { useState } from "react";
import { data, Link, redirect, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/new";
import { RecipeFileEditor } from "../../components/recipe-file-editor";
import { getDb } from "../../lib/db";
import { createRecipe } from "../../lib/recipe-creator";

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
  const form = await request.formData();
  const content = form.get("content");

  if (typeof content !== "string") {
    return data({ errors: { content: "The recipe file can't be empty." } }, 422);
  }

  const result = await createRecipe(getDb(env.DB), env.RECIPES, content);

  if (!result.ok) {
    return data({ errors: { content: result.error } }, 422);
  }

  return redirect(`/recipes/${result.slug}`);
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
