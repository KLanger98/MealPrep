import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { localToday, weekdayShort } from "../lib/dates";
import type { PersonOption } from "../lib/people";
import type { CalendarAssignment, RecipeOption } from "./assignment-card";

// Prefill for a new assignment: { date, slot } from the calendar, or
// { recipe } from a recipe page. For editing: { assignment }.
export interface ModalContext {
  date?: string;
  slot?: string;
  recipe?: RecipeOption;
  assignment?: CalendarAssignment;
}

const formatServings = (n: number) => String(Math.round(n * 100) / 100);
const formatScale = (n: number) => String(Math.round(n * 100) / 100);

const inputClass =
  "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm dark:border-stone-700 dark:bg-stone-950";

// Mounted only while open, so all state initialises from `context`.
export function AssignmentModal({
  recipes,
  people,
  slots,
  context,
  onClose,
}: {
  recipes: RecipeOption[];
  /** The household; the picker is hidden while it's empty. */
  people: PersonOption[];
  slots: string[];
  context: ModalContext;
  onClose: () => void;
}) {
  const fetcher = useFetcher<{ ok?: boolean; errors?: Record<string, string> }>();
  const editing = context.assignment;
  const presetRecipe = context.recipe;

  const [recipeId, setRecipeId] = useState<number | null>(presetRecipe?.id ?? null);
  const [slot, setSlot] = useState(
    editing?.slot ??
      context.slot ??
      // Coming from a recipe page, its meal type is the obvious slot.
      (presetRecipe && slots.includes(presetRecipe.type) ? presetRecipe.type : "dinner"),
  );
  const [startDate, setStartDate] = useState(context.date ?? localToday());
  const [endDate, setEndDate] = useState(context.date ?? localToday());
  const [search, setSearch] = useState("");
  const [personIds, setPersonIds] = useState<number[]>(
    editing?.people.map((person) => person.id) ?? [],
  );

  function togglePerson(id: number) {
    setPersonIds((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    );
  }

  const submitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) onClose();
  }, [fetcher.state, fetcher.data, onClose]);

  const term = search.toLowerCase().trim();
  const filteredRecipes = term
    ? recipes.filter((r) => r.title.toLowerCase().includes(term))
    : recipes;

  const selectedRecipe = presetRecipe ?? recipes.find((r) => r.id === recipeId);
  // What the servings are measured against: the batch's recipe when
  // editing (it isn't in the picker), otherwise whatever's picked.
  const baseRecipe = editing?.recipe ?? selectedRecipe;

  // You think in servings ("cook 6"); the row stores a scale factor
  // (6 / recipe's 4 = 1.5). Held as raw text so it can be emptied or
  // half-typed mid-edit; it only has to be valid by save time. Until you
  // touch it, it follows the picked recipe's own servings.
  const [servingsInput, setServingsInput] = useState(
    editing ? formatServings(editing.recipe.servings * editing.scale_factor) : "",
  );
  const [servingsTouched, setServingsTouched] = useState(editing !== undefined);
  const [servingsError, setServingsError] = useState<string | null>(null);
  const servingsText =
    servingsTouched || !baseRecipe ? servingsInput : String(baseRecipe.servings);
  const parsedServings = servingsText.trim() === "" ? NaN : Number(servingsText);
  const scaleFactor =
    baseRecipe && Number.isFinite(parsedServings) && parsedServings > 0
      ? Math.round((parsedServings / baseRecipe.servings) * 1000) / 1000
      : null;
  const scaleInRange = scaleFactor !== null && scaleFactor >= 0.1 && scaleFactor <= 20;

  // "one cook, eaten Wed–Fri" — the submit button carries the batch
  // semantics instead of an explanatory paragraph.
  const isBatch = !editing && startDate !== "" && endDate > startDate;
  const submitLabel = editing
    ? "Save batch"
    : isBatch
      ? `Add — one cook, eaten ${weekdayShort(startDate)}–${weekdayShort(endDate)}`
      : "Add";

  function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!baseRecipe) return;
    if (scaleFactor === null || !scaleInRange) {
      const min = formatServings(baseRecipe.servings * 0.1);
      const max = formatServings(baseRecipe.servings * 20);
      setServingsError(`Servings must be a number between ${min} and ${max}.`);
      return;
    }

    if (editing) {
      fetcher.submit(
        { scale_factor: scaleFactor, slot, person_ids: personIds },
        {
          method: "patch",
          action: `/assignments/batch/${editing.batch_id}`,
          encType: "application/json",
        },
      );
      return;
    }

    fetcher.submit(
      {
        recipe_id: recipeId,
        slot,
        start_date: startDate,
        end_date: endDate,
        scale_factor: scaleFactor,
        person_ids: personIds,
      },
      { method: "post", action: "/assignments", encType: "application/json" },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-paper p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-xl sm:pb-5 dark:bg-stone-900">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-stone-200 sm:hidden dark:bg-stone-700" />
        <h2 className="text-lg font-semibold">
          {editing ? `Edit batch — ${editing.recipe.title}` : "Add to calendar"}
        </h2>
        {presetRecipe && !editing && (
          <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
            {presetRecipe.title} · {presetRecipe.servings} servings per cook
          </p>
        )}

        <form className="mt-4 space-y-4" onSubmit={submit}>
          {!editing && !presetRecipe && (
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
                Recipe
              </label>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className={inputClass}
              />
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-1 dark:border-stone-700">
                {filteredRecipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                      recipeId === recipe.id
                        ? "bg-primary text-on-primary"
                        : "hover:bg-stone-100 dark:hover:bg-stone-800"
                    }`}
                    onClick={() => setRecipeId(recipe.id)}
                  >
                    <span>{recipe.title}</span>
                    <span className="text-xs opacity-70">
                      {recipe.servings} serv · {recipe.type}
                    </span>
                  </button>
                ))}
                {filteredRecipes.length === 0 && (
                  <p className="px-2 py-1.5 text-sm text-stone-400 dark:text-stone-500">
                    No matches.
                  </p>
                )}
              </div>
            </div>
          )}

          <div>
            <span className="block text-sm font-medium text-stone-700 dark:text-stone-300">
              Slot
            </span>
            <div className="mt-1 flex gap-1.5">
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium capitalize ${
                    slot === s
                      ? "border-accent-300 bg-accent-50 text-accent-800 dark:border-accent-900 dark:bg-accent-950 dark:text-accent-300"
                      : "border-stone-300 text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                  }`}
                  onClick={() => setSlot(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {people.length > 0 && (
            <div>
              <span className="block text-sm font-medium text-stone-700 dark:text-stone-300">
                Who's eating
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {people.map((person) => {
                  const selected = personIds.includes(person.id);
                  return (
                    <button
                      key={person.id}
                      type="button"
                      aria-pressed={selected}
                      className={`rounded-full border px-3 py-1 text-sm ${
                        selected
                          ? "border-accent-300 bg-accent-50 font-medium text-accent-800 dark:border-accent-900 dark:bg-accent-950 dark:text-accent-300"
                          : "border-stone-300 text-stone-600 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
                      }`}
                      onClick={() => togglePerson(person.id)}
                    >
                      {person.name}
                    </button>
                  );
                })}
              </div>
              {editing && editing.batch_days > 1 && (
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  Applies to all {editing.batch_days} days of this batch.
                </p>
              )}
            </div>
          )}

          {!editing && (
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex-1 text-sm font-medium text-stone-700 dark:text-stone-300">
                From
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex-1 text-sm font-medium text-stone-700 dark:text-stone-300">
                To
                <input
                  type="date"
                  required
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>
          )}

          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
            Servings to cook
            <input
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              value={servingsText}
              placeholder={baseRecipe ? String(baseRecipe.servings) : "Pick a recipe first"}
              disabled={!baseRecipe}
              onChange={(e) => {
                setServingsInput(e.target.value);
                setServingsTouched(true);
                setServingsError(null);
              }}
              className={`${inputClass} disabled:opacity-50`}
            />
          </label>

          {baseRecipe && scaleFactor !== null && scaleInRange && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {scaleFactor === 1
                ? `The recipe as written (${baseRecipe.servings} servings).`
                : `${formatScale(scaleFactor)}× the recipe (written for ${baseRecipe.servings}).`}
            </p>
          )}

          {servingsError && (
            <p className="text-xs text-red-600 dark:text-red-400">{servingsError}</p>
          )}

          {fetcher.data?.errors && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {Object.values(fetcher.data.errors).join(" ")}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 sm:py-1.5 dark:text-stone-300 dark:hover:bg-stone-800"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50 sm:py-1.5"
              disabled={submitting || (!editing && recipeId === null)}
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
