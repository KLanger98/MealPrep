import { env } from "cloudflare:workers";
import { useEffect, useState } from "react";
import { data, Link, redirect, useFetcher, useLoaderData } from "react-router";
import { asc, eq } from "drizzle-orm";
import type { Route } from "./+types/show";
import type { ShoppingItemSource } from "../../../database/schema";
import { shoppingListItems, shoppingLists } from "../../../database/schema";
import { formatDayMonth, formatDayMonthYear } from "../../lib/dates";
import { getDb } from "../../lib/db";
import { formatAmount } from "../../lib/format-quantity";
import { generate } from "../../lib/shopping-list-generator";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.list.name || loaderData?.list.label || "Shopping list"} — Meal Prep` }];
}

interface Item {
  id: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  sources: ShoppingItemSource[];
  checked: boolean;
}

async function findList(id: string) {
  const rows = await getDb(env.DB)
    .select()
    .from(shoppingLists)
    .where(eq(shoppingLists.id, Number(id)))
    .limit(1);

  if (!rows[0]) throw data(null, 404);
  return rows[0];
}

export async function loader({ params }: Route.LoaderArgs) {
  const db = getDb(env.DB);
  const list = await findList(params.id);

  const items = await db
    .select()
    .from(shoppingListItems)
    .where(eq(shoppingListItems.shopping_list_id, list.id))
    .orderBy(asc(shoppingListItems.sort_order));

  return {
    list: {
      id: list.id,
      name: list.name,
      label: `${formatDayMonth(list.start_date)} – ${formatDayMonthYear(list.end_date)}`,
      items: items.map(
        (item): Item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          category: item.category,
          sources: item.sources,
          checked: item.checked_at !== null,
        }),
      ),
    },
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const db = getDb(env.DB);
  const list = await findList(params.id);

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "toggle") {
    const itemId = Number(form.get("itemId"));
    const rows = await db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.id, itemId))
      .limit(1);

    const item = rows[0];
    if (!item || item.shopping_list_id !== list.id) throw data(null, 404);

    await db
      .update(shoppingListItems)
      .set({ checked_at: item.checked_at === null ? new Date().toISOString() : null })
      .where(eq(shoppingListItems.id, item.id));

    return { ok: true };
  }

  if (intent === "regenerate") {
    await generate(db, list);
    return { ok: true };
  }

  if (intent === "delete") {
    await db.delete(shoppingLists).where(eq(shoppingLists.id, list.id));
    return redirect("/shopping-lists");
  }

  throw data(null, 400);
}

function sourcesLabel(item: Item): string {
  return item.sources
    .map((s) => {
      const amount = s.quantity !== null ? formatAmount(s.quantity, s.unit) : "to taste";
      const scale = s.scale !== 1 ? ` ×${s.scale}` : "";
      return `${s.recipe}${scale}: ${amount}`;
    })
    .join("\n");
}

function ItemCheckbox({ item, listId }: { item: Item; listId: number }) {
  const fetcher = useFetcher();

  // Optimistic: reflect the in-flight toggle immediately.
  const checked = fetcher.formData
    ? fetcher.formData.get("intent") === "toggle"
      ? !item.checked
      : item.checked
    : item.checked;

  return (
    <input
      type="checkbox"
      checked={checked}
      className="size-4 translate-y-0.5 rounded border-stone-300 text-green-600 focus:ring-green-500 dark:border-stone-600 dark:bg-stone-800"
      onChange={() =>
        fetcher.submit(
          { intent: "toggle", itemId: item.id },
          { method: "post", action: `/shopping-lists/${listId}` },
        )
      }
    />
  );
}

export default function ShowShoppingList() {
  const { list } = useLoaderData<typeof loader>();
  const regenerate = useFetcher();

  // 'aisle' groups merged items by category; 'recipe' regroups the same
  // items under each recipe that needs them. SSR renders the default and the
  // saved preference loads after hydration.
  const [viewMode, setViewMode] = useState<"aisle" | "recipe">("aisle");

  useEffect(() => {
    const saved = localStorage.getItem("shopping-list-view");
    if (saved === "recipe") setViewMode("recipe");
  }, []);

  function switchView(mode: "aisle" | "recipe") {
    setViewMode(mode);
    localStorage.setItem("shopping-list-view", mode);
  }

  const groups = (() => {
    const map = new Map<string, Item[]>();
    for (const item of list.items) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return [...map.entries()].map(([category, items]) => ({ category, items }));
  })();

  const recipeGroups = (() => {
    const map = new Map<string, { scale: number; entries: { item: Item; source: ShoppingItemSource }[] }>();
    for (const item of list.items) {
      for (const source of item.sources) {
        if (!map.has(source.recipe)) map.set(source.recipe, { scale: source.scale, entries: [] });
        map.get(source.recipe)!.entries.push({ item, source });
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([recipe, group]) => ({
        recipe,
        scale: group.scale,
        entries: group.entries.sort((a, b) => a.item.name.localeCompare(b.item.name)),
      }));
  })();

  const checkedCount = list.items.filter((i) => i.checked).length;

  const toggleButton = (mode: "aisle" | "recipe", label: string) => (
    <button
      type="button"
      className={`rounded-md px-3 py-1 ${
        viewMode === mode
          ? "bg-green-600 text-white"
          : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
      }`}
      onClick={() => switchView(mode)}
    >
      {label}
    </button>
  );

  const itemText = (item: Item) => (
    <span className={item.checked ? "text-stone-400 line-through dark:text-stone-500" : ""}>
      {item.quantity !== null && (
        <span className="font-medium tabular-nums">
          {formatAmount(item.quantity, item.unit)}
        </span>
      )}{" "}
      {item.name}
    </span>
  );

  return (
    <>
      <Link
        to="/shopping-lists"
        className="text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
      >
        ← All lists
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{list.name || list.label}</h1>
          {list.name && (
            <p className="text-sm text-stone-500 dark:text-stone-400">{list.label}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-stone-500 dark:text-stone-400">
            {checkedCount}/{list.items.length} ticked
          </span>
          <div className="flex rounded-lg border border-stone-300 bg-white p-0.5 text-sm dark:border-stone-700 dark:bg-stone-900">
            {toggleButton("aisle", "By aisle")}
            {toggleButton("recipe", "By recipe")}
          </div>
          <button
            type="button"
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800"
            title="Rebuild from the calendar (keeps ticked items ticked)"
            disabled={regenerate.state !== "idle"}
            onClick={() =>
              regenerate.submit(
                { intent: "regenerate" },
                { method: "post", action: `/shopping-lists/${list.id}` },
              )
            }
          >
            ↻ Regenerate
          </button>
        </div>
      </div>

      {viewMode === "recipe" && recipeGroups.length > 0 ? (
        <div className="mt-6 space-y-6">
          {recipeGroups.map((group) => (
            <section key={group.recipe}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                {group.recipe}
                {group.scale !== 1 && (
                  <span className="ml-1 normal-case text-green-700 dark:text-green-400">
                    ×{group.scale}
                  </span>
                )}
              </h2>
              <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
                {group.entries.map(({ item, source }) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-baseline gap-3 px-4 py-2.5">
                      <ItemCheckbox item={item} listId={list.id} />
                      <span
                        className={
                          item.checked
                            ? "text-stone-400 line-through dark:text-stone-500"
                            : ""
                        }
                      >
                        {source.quantity !== null && (
                          <span className="font-medium tabular-nums">
                            {formatAmount(source.quantity, source.unit)}
                          </span>
                        )}{" "}
                        {item.name}
                      </span>
                      {item.sources.length > 1 && (
                        <span className="ml-auto shrink-0 text-xs text-stone-400 dark:text-stone-500">
                          {item.quantity !== null
                            ? `${formatAmount(item.quantity, item.unit)} total`
                            : "also elsewhere"}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : groups.length > 0 ? (
        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <section key={group.category}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
                {group.category}
              </h2>
              <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white dark:divide-stone-800 dark:border-stone-800 dark:bg-stone-900">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <label
                      className="flex cursor-pointer items-baseline gap-3 px-4 py-2.5"
                      title={sourcesLabel(item)}
                    >
                      <ItemCheckbox item={item} listId={list.id} />
                      {itemText(item)}
                      {item.sources.length > 1 && (
                        <span
                          className="ml-auto shrink-0 text-xs text-stone-400 dark:text-stone-500"
                          title={sourcesLabel(item)}
                        >
                          {item.sources.length} recipes
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-10 text-center text-stone-500 dark:text-stone-400">
          Nothing to buy — no recipes are scheduled on the calendar in this
          date range.
        </p>
      )}
    </>
  );
}
