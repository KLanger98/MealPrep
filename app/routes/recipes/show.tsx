import { env } from "cloudflare:workers";
import { useRef, useState } from "react";
import {
  data,
  Link,
  redirect,
  useFetcher,
  useLoaderData,
  useSubmit,
} from "react-router";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/show";
import { recipes } from "../../../database/schema";
import { IngredientList } from "../../components/ingredient-list";
import { COST_LABELS } from "../../components/recipe-card";
import { getDb } from "../../lib/db";
import { setFrontmatterRating } from "../../lib/frontmatter-surgery";
import { renderMarkdown } from "../../lib/markdown";
import { syncOne } from "../../lib/recipe-syncer";
import { prepareUpload } from "../../lib/photo-resize";
import { recipeImageUrl } from "../../lib/urls";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.recipe.title ?? "Recipe"} — Meal Prep` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const db = getDb(env.DB);
  const rows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.slug, params.slug))
    .limit(1);

  const recipe = rows[0];
  if (!recipe) throw data(null, 404);

  return {
    recipe: {
      slug: recipe.slug,
      title: recipe.title,
      type: recipe.type,
      protein: recipe.protein,
      cost: recipe.cost,
      source: recipe.source,
      rating: recipe.rating,
      prep_minutes: recipe.prep_minutes,
      cook_minutes: recipe.cook_minutes,
      servings: recipe.servings,
      tags: recipe.tags,
      ingredients: recipe.ingredients,
      body_html: renderMarkdown(recipe.body_markdown ?? ""),
      missing: recipe.missing_at !== null,
      file: recipe.r2_key,
      image_url: recipeImageUrl(recipe.slug, recipe.image_key, recipe.image_etag),
    },
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const db = getDb(env.DB);
  const rows = await db
    .select()
    .from(recipes)
    .where(eq(recipes.slug, params.slug))
    .limit(1);

  const recipe = rows[0];
  if (!recipe) throw data(null, 404);

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    // Explicit delete removes the file, photo and index row (assignments
    // cascade), unlike a file disappearing on its own, which only flags
    // missing_at.
    await env.RECIPES.delete(
      [recipe.r2_key, recipe.image_key].filter((k): k is string => k !== null),
    );
    await db.delete(recipes).where(eq(recipes.id, recipe.id));
    return redirect("/recipes");
  }

  if (intent === "rate") {
    // Set or clear the rating by rewriting just the `rating:` line in the
    // file's frontmatter — the file stays the source of truth.
    const raw = form.get("rating");
    const rating =
      raw === null || raw === "" ? null : Math.round(Number(raw) * 10) / 10;

    if (rating !== null && (!Number.isFinite(rating) || rating < 0 || rating > 10)) {
      return data({ errors: { rating: "Rating must be between 0 and 10." } }, 422);
    }

    const object = await env.RECIPES.get(recipe.r2_key);
    if (object === null) {
      return data(
        { errors: { rating: "The recipe file is missing — restore it before rating." } },
        422,
      );
    }

    const updated = setFrontmatterRating(await object.text(), rating);
    if (updated === null) {
      return data(
        { errors: { rating: "Could not find the frontmatter block in the recipe file." } },
        422,
      );
    }

    const put = await env.RECIPES.put(recipe.r2_key, updated, {
      httpMetadata: { contentType: "text/markdown" },
    });
    await syncOne(db, env.RECIPES, recipe.r2_key, updated, put!.etag);

    return { ok: true };
  }

  throw data(null, 400);
}

export default function ShowRecipe() {
  const { recipe } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const rate = useFetcher();
  const photo = useFetcher<{ errors?: { photo?: string } }>();

  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [resizeError, setResizeError] = useState<string | null>(null);

  // Display-only scaling: nothing here is persisted.
  const [targetServings, setTargetServings] = useState(recipe.servings);
  const scale = targetServings / recipe.servings;
  const presets = [0.5, 1, 1.5, 2];

  function destroyRecipe() {
    if (
      confirm(
        `Delete "${recipe.title}"? This deletes the .md file and removes it from any meal plans.`,
      )
    ) {
      submit({ intent: "delete" }, { method: "post" });
    }
  }

  function setRating(value: number) {
    // Clicking the current rating clears it.
    const rating = value === recipe.rating ? "" : String(value);
    rate.submit({ intent: "rate", rating }, { method: "post" });
  }

  async function uploadPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setResizeError(null);

    try {
      const blob = await prepareUpload(file);
      const form = new FormData();
      form.append("photo", blob, "photo.jpg");
      photo.submit(form, {
        method: "post",
        action: `/recipes/${recipe.slug}/image`,
        encType: "multipart/form-data",
      });
    } catch (e) {
      setResizeError(e instanceof Error ? e.message : "Could not process the photo.");
    } finally {
      event.target.value = "";
    }
  }

  function removePhoto() {
    if (confirm("Remove this photo? The image file will be deleted from the recipes bucket.")) {
      photo.submit(null, {
        method: "delete",
        action: `/recipes/${recipe.slug}/image`,
      });
    }
  }

  const uploadingPhoto = photo.state !== "idle";
  const photoError = resizeError ?? photo.data?.errors?.photo;

  const sourceIsUrl = /^https?:\/\//i.test(recipe.source ?? "");
  let sourceLabel = recipe.source;
  if (sourceIsUrl && recipe.source) {
    try {
      sourceLabel = new URL(recipe.source).hostname.replace(/^www\./, "");
    } catch {
      sourceLabel = recipe.source;
    }
  }

  return (
    <>
      <Link
        to="/recipes"
        className="text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
      >
        ← All recipes
      </Link>

      {recipe.missing && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          The file for this recipe (
          <span className="font-mono">{recipe.file}</span>) is missing. Showing
          the last indexed version.
        </div>
      )}

      <div className="relative mt-4">
        {recipe.image_url && (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="max-h-80 w-full rounded-xl object-cover"
          />
        )}
        <div
          className={`flex gap-2 ${recipe.image_url ? "absolute bottom-3 right-3" : ""}`}
        >
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm shadow-sm ${
              recipe.image_url
                ? "bg-white/90 text-stone-700 hover:bg-white dark:bg-stone-900/90 dark:text-stone-200 dark:hover:bg-stone-900"
                : "border border-dashed border-stone-300 text-stone-500 hover:border-green-400 hover:text-green-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-green-500 dark:hover:text-green-400"
            }`}
            disabled={uploadingPhoto}
            onClick={() => photoInput.current?.click()}
          >
            {uploadingPhoto
              ? "Uploading…"
              : recipe.image_url
                ? "Change photo"
                : "+ Add photo"}
          </button>
          {recipe.image_url && (
            <button
              type="button"
              className="rounded-lg bg-white/90 px-3 py-1.5 text-sm text-red-600 shadow-sm hover:bg-white dark:bg-stone-900/90 dark:text-red-400 dark:hover:bg-stone-900"
              onClick={removePhoto}
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={photoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={uploadPhoto}
        />
      </div>
      {photoError && <p className="mt-2 text-sm text-red-600">{photoError}</p>}

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">{recipe.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-full bg-green-50 px-2 py-0.5 font-medium capitalize text-green-800 dark:bg-green-950 dark:text-green-300">
              {recipe.type}
            </span>
            {recipe.protein && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 capitalize text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                {recipe.protein}
              </span>
            )}
            {recipe.cost && (
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                {COST_LABELS[recipe.cost] ?? recipe.cost}
              </span>
            )}
            {(recipe.tags ?? []).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-stone-500 dark:text-stone-400">
            {recipe.prep_minutes && <span>Prep {recipe.prep_minutes} min</span>}
            {recipe.cook_minutes && <span>Cook {recipe.cook_minutes} min</span>}
            {recipe.source && (
              <span>
                Source:{" "}
                {sourceIsUrl ? (
                  <a
                    href={recipe.source}
                    target="_blank"
                    rel="noopener"
                    className="text-green-700 underline underline-offset-2 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                  >
                    {sourceLabel}
                  </a>
                ) : (
                  <span>{recipe.source}</span>
                )}
              </span>
            )}
          </div>

          <div
            className="mt-3 flex items-center gap-1"
            onMouseLeave={() => setHoverRating(null)}
          >
            <span className="mr-1 text-sm text-stone-500 dark:text-stone-400">
              Rating:
            </span>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
              <button
                key={star}
                type="button"
                className={`text-lg leading-none transition-colors ${
                  star <= (hoverRating ?? recipe.rating ?? 0)
                    ? "text-amber-500"
                    : "text-stone-300 hover:text-amber-300 dark:text-stone-600 dark:hover:text-amber-500"
                }`}
                title={`${star}/10${star === recipe.rating ? " (click to clear)" : ""}`}
                onMouseEnter={() => setHoverRating(star)}
                onClick={() => setRating(star)}
              >
                ★
              </button>
            ))}
            {recipe.rating !== null ? (
              <span className="ml-1 text-sm font-medium text-stone-700 dark:text-stone-300">
                {recipe.rating}/10
              </span>
            ) : (
              <span className="ml-1 text-sm text-stone-400 dark:text-stone-500">
                not rated
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!recipe.missing && (
            <Link
              to={`/recipes/${recipe.slug}/edit`}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800"
            >
              Edit
            </Link>
          )}
          <button
            type="button"
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-stone-700 dark:bg-stone-900 dark:text-red-400 dark:hover:bg-red-950"
            onClick={destroyRecipe}
          >
            Delete
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(280px,1fr)_2fr]">
        <aside>
          <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Ingredients</h2>
              <div className="flex items-center gap-1">
                {presets.map((factor) => (
                  <button
                    key={factor}
                    type="button"
                    className={`rounded-md px-2 py-1 text-xs font-medium ${
                      Math.abs(scale - factor) < 0.001
                        ? "bg-green-600 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                    }`}
                    onClick={() =>
                      setTargetServings(
                        Math.round(recipe.servings * factor * 100) / 100,
                      )
                    }
                  >
                    {factor}×
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
              <span>Servings:</span>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={targetServings}
                onChange={(e) => setTargetServings(Number(e.target.value) || recipe.servings)}
                className="w-20 rounded-md border border-stone-300 px-2 py-1 text-sm dark:border-stone-700 dark:bg-stone-950"
              />
              {Math.abs(scale - 1) > 0.001 && (
                <span className="text-xs text-green-700 dark:text-green-400">
                  ({Math.round(scale * 100) / 100}× recipe)
                </span>
              )}
            </label>

            <IngredientList
              className="mt-3"
              ingredients={recipe.ingredients}
              scale={scale}
            />
          </div>
        </aside>

        <article
          className="prose prose-stone max-w-none prose-headings:font-semibold dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: recipe.body_html }}
        />
      </div>
    </>
  );
}
