import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import type { CalendarAssignment, RecipeOption } from "./assignment-card";

// Prefill for a new assignment: { date, slot }. For editing: { assignment }.
export interface ModalContext {
  date?: string;
  slot?: string;
  assignment?: CalendarAssignment;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-stone-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950";

// Mounted only while open, so all state initialises from `context`.
export function AssignmentModal({
  recipes,
  slots,
  context,
  onClose,
}: {
  recipes: RecipeOption[];
  slots: string[];
  context: ModalContext;
  onClose: () => void;
}) {
  const fetcher = useFetcher<{ ok?: boolean; errors?: Record<string, string> }>();
  const editing = context.assignment;

  const [recipeId, setRecipeId] = useState<number | null>(null);
  const [slot, setSlot] = useState(editing?.slot ?? context.slot ?? "dinner");
  const [startDate, setStartDate] = useState(context.date ?? "");
  const [endDate, setEndDate] = useState(context.date ?? "");
  const [scaleFactor, setScaleFactor] = useState(editing?.scale_factor ?? 1);
  const [search, setSearch] = useState("");

  const submitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) onClose();
  }, [fetcher.state, fetcher.data, onClose]);

  const term = search.toLowerCase().trim();
  const filteredRecipes = term
    ? recipes.filter((r) => r.title.toLowerCase().includes(term))
    : recipes;

  const selectedRecipe = recipes.find((r) => r.id === recipeId);
  const totalServings = selectedRecipe
    ? Math.round(selectedRecipe.servings * scaleFactor * 100) / 100
    : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();

    if (editing) {
      fetcher.submit(
        { scale_factor: scaleFactor, slot },
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
      },
      { method: "post", action: "/assignments", encType: "application/json" },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-stone-900">
        <h2 className="text-lg font-semibold">
          {editing ? `Edit batch — ${editing.recipe.title}` : "Add to calendar"}
        </h2>

        <form className="mt-4 space-y-4" onSubmit={submit}>
          {!editing && (
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
                Recipe
              </label>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950"
              />
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-1 dark:border-stone-700">
                {filteredRecipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${
                      recipeId === recipe.id
                        ? "bg-green-600 text-white"
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

          <div className="flex gap-3">
            <label className="flex-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Slot
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                className={`${inputClass} capitalize`}
              >
                {slots.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="flex-1 text-sm font-medium text-stone-700 dark:text-stone-300">
              Scale
              <input
                type="number"
                min={0.1}
                max={20}
                step="any"
                value={scaleFactor}
                onChange={(e) => setScaleFactor(Number(e.target.value))}
                className={inputClass}
              />
            </label>
          </div>

          {totalServings !== null && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Makes {totalServings} servings ({selectedRecipe!.servings} ×{" "}
              {scaleFactor}).
            </p>
          )}

          {!editing && (
            <div className="flex gap-3">
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

          {!editing && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Covering multiple days means one cook (one batch) eaten across
              those days.
            </p>
          )}

          {fetcher.data?.errors && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {Object.values(fetcher.data.errors).join(" ")}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              disabled={submitting || (!editing && recipeId === null)}
            >
              {editing ? "Save batch" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
