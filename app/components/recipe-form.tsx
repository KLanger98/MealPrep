import { useState } from "react";
import { Form } from "react-router";
import { CATEGORY_ORDER, COSTS, RECIPE_TYPES, UNITS } from "../lib/config";
import type { IngredientDraft, RecipeFormErrors } from "../lib/recipe-form";

export interface RecipeFormValues {
  title: string;
  slug: string;
  type: string;
  servings: string;
  protein: string;
  cost: string;
  source: string;
  prep_minutes: string;
  cook_minutes: string;
  tags: string;
  body_markdown: string;
  ingredients: IngredientDraft[];
}

const EMPTY_ROW: IngredientDraft = {
  name: "",
  quantity: "",
  unit: "",
  note: "",
  category: "",
};

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-paper px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-stone-700 dark:bg-stone-900";

function Field({
  label,
  error,
  hint,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
        {label}
      </span>
      <div className="mt-1">{children}</div>
      {hint && !error && (
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </label>
  );
}

export function RecipeForm({
  initial,
  knownIngredients,
  errors = {},
  editingSlug,
  processing = false,
  submitLabel = "Save",
}: {
  initial: RecipeFormValues;
  knownIngredients: { name: string; category: string | null }[];
  errors?: RecipeFormErrors;
  /** Set when editing: the slug is shown but can't be changed. */
  editingSlug?: string;
  processing?: boolean;
  submitLabel?: string;
}) {
  const [rows, setRows] = useState<IngredientDraft[]>(
    initial.ingredients.length > 0 ? initial.ingredients : [{ ...EMPTY_ROW }],
  );

  const categoryOf = new Map(knownIngredients.map((i) => [i.name, i.category]));

  function updateRow(index: number, patch: Partial<IngredientDraft>) {
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function renameRow(index: number, name: string) {
    // Picking a known ingredient brings its category along, so the same
    // ingredient always lands in the same shopping-list aisle.
    const known = categoryOf.get(name.trim().toLowerCase());
    updateRow(index, known ? { name, category: known } : { name });
  }

  function moveRow(index: number, offset: -1 | 1) {
    setRows((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const isNew = (name: string) => {
    const key = name.trim().toLowerCase();
    return key !== "" && !categoryOf.has(key);
  };

  return (
    <Form method="post" className="mt-4 space-y-6">
      <input type="hidden" name="ingredients" value={JSON.stringify(rows)} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" error={errors.title} className="sm:col-span-2">
          <input name="title" defaultValue={initial.title} className={inputClass} required />
        </Field>

        {editingSlug ? (
          <Field label="Slug" hint="The recipe's permanent ID — it can't be changed.">
            <input value={editingSlug} className={`${inputClass} opacity-60`} disabled readOnly />
          </Field>
        ) : (
          <Field label="Slug" error={errors.slug} hint="Optional — made from the title if left blank.">
            <input name="slug" defaultValue={initial.slug} className={inputClass} placeholder="beef-chilli" />
          </Field>
        )}

        <Field label="Type" error={errors.type}>
          <select name="type" defaultValue={initial.type} className={`${inputClass} capitalize`}>
            {RECIPE_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </Field>

        <Field label="Servings" error={errors.servings}>
          <input name="servings" type="number" min={1} step={1} defaultValue={initial.servings} className={inputClass} required />
        </Field>

        <Field label="Cost" error={errors.cost}>
          <select name="cost" defaultValue={initial.cost} className={`${inputClass} capitalize`}>
            <option value="">—</option>
            {COSTS.map((cost) => (
              <option key={cost} value={cost}>{cost}</option>
            ))}
          </select>
        </Field>

        <Field label="Protein">
          <input name="protein" defaultValue={initial.protein} className={inputClass} placeholder="chicken" />
        </Field>

        <Field label="Source" hint="A URL or a note like “Mum's recipe”.">
          <input name="source" defaultValue={initial.source} className={inputClass} />
        </Field>

        <Field label="Prep (minutes)" error={errors.prep_minutes}>
          <input name="prep_minutes" type="number" min={0} step={1} defaultValue={initial.prep_minutes} className={inputClass} />
        </Field>

        <Field label="Cook (minutes)" error={errors.cook_minutes}>
          <input name="cook_minutes" type="number" min={0} step={1} defaultValue={initial.cook_minutes} className={inputClass} />
        </Field>

        <Field label="Tags" hint="Comma separated." className="sm:col-span-2">
          <input name="tags" defaultValue={initial.tags} className={inputClass} placeholder="meal-prep-friendly, freezes-well" />
        </Field>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-stone-700 dark:text-stone-300">
          Ingredients
        </legend>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Pick existing names where you can — shopping lists merge by
          ingredient. Leave the quantity blank for “to taste” items.
        </p>
        {errors.ingredients && (
          <p className="mt-2 whitespace-pre-line text-xs text-red-600 dark:text-red-400">
            {errors.ingredients}
          </p>
        )}

        <datalist id="known-ingredients">
          {knownIngredients.map((ingredient) => (
            <option key={ingredient.name} value={ingredient.name} />
          ))}
        </datalist>
        <datalist id="known-units">
          {UNITS.map((unit) => (
            <option key={unit} value={unit} />
          ))}
        </datalist>

        <ul className="mt-3 space-y-3">
          {rows.map((row, i) => (
            <li
              key={i}
              className="grid grid-cols-6 gap-2 rounded-xl border border-stone-200 bg-paper p-3 sm:grid-cols-12 dark:border-stone-800 dark:bg-stone-900"
            >
              <div className="col-span-6 sm:col-span-4">
                <input
                  aria-label="Ingredient name"
                  list="known-ingredients"
                  value={row.name}
                  placeholder="chicken thighs"
                  className={inputClass}
                  onChange={(e) => renameRow(i, e.target.value)}
                />
                {isNew(row.name) && (
                  <p className="mt-1 text-xs text-caramel-600 dark:text-caramel-400">
                    New ingredient
                  </p>
                )}
              </div>
              <input
                aria-label="Quantity"
                value={row.quantity}
                placeholder="800"
                inputMode="decimal"
                className={`${inputClass} col-span-3 sm:col-span-2`}
                onChange={(e) => updateRow(i, { quantity: e.target.value })}
              />
              <input
                aria-label="Unit"
                list="known-units"
                value={row.unit}
                placeholder="g"
                className={`${inputClass} col-span-3 sm:col-span-2`}
                onChange={(e) => updateRow(i, { unit: e.target.value })}
              />
              <select
                aria-label="Category"
                value={row.category}
                className={`${inputClass} col-span-6 capitalize sm:col-span-4`}
                onChange={(e) => updateRow(i, { category: e.target.value })}
              >
                <option value="">Category…</option>
                {CATEGORY_ORDER.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <input
                aria-label="Note"
                value={row.note}
                placeholder="Note, e.g. finely diced"
                className={`${inputClass} col-span-6 sm:col-span-9`}
                onChange={(e) => updateRow(i, { note: e.target.value })}
              />
              <div className="col-span-6 flex items-center justify-end gap-1 sm:col-span-3">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  className="rounded-md px-2 py-1 text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-800"
                  onClick={() => moveRow(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === rows.length - 1}
                  className="rounded-md px-2 py-1 text-sm text-stone-500 hover:bg-stone-100 disabled:opacity-30 dark:hover:bg-stone-800"
                  onClick={() => moveRow(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                  onClick={() =>
                    setRows((current) =>
                      current.length === 1
                        ? [{ ...EMPTY_ROW }]
                        : current.filter((_, index) => index !== i),
                    )
                  }
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="mt-3 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-600 hover:border-accent-400 hover:text-accent-700 dark:border-stone-700 dark:text-stone-300 dark:hover:border-accent-500 dark:hover:text-accent-400"
          onClick={() => setRows((current) => [...current, { ...EMPTY_ROW }])}
        >
          + Add ingredient
        </button>
      </fieldset>

      <Field
        label="Method & notes"
        error={errors.body_markdown}
        hint="Markdown — e.g. a “## Method” heading with numbered steps, then “## Notes”."
      >
        <textarea
          name="body_markdown"
          defaultValue={initial.body_markdown}
          rows={16}
          className={`${inputClass} font-mono leading-relaxed`}
        />
      </Field>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          disabled={processing}
        >
          {submitLabel}
        </button>
      </div>
    </Form>
  );
}
