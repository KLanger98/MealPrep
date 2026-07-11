import { env } from "cloudflare:workers";
import { useState } from "react";
import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
} from "react-router";
import { desc, eq, sql } from "drizzle-orm";
import type { Route } from "./+types/index";
import { shoppingListItems, shoppingLists } from "../../../database/schema";
import { addDays, formatDayMonth, formatDayMonthYear, isValidDate, startOfWeek } from "../../lib/dates";
import { getDb } from "../../lib/db";
import { generate } from "../../lib/shopping-list-generator";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Shopping Lists — Meal Prep" }];
}

export async function loader() {
  const db = getDb(env.DB);

  const lists = await db
    .select({
      id: shoppingLists.id,
      name: shoppingLists.name,
      start_date: shoppingLists.start_date,
      end_date: shoppingLists.end_date,
      items_count: sql<number>`count(${shoppingListItems.id})`,
      checked_items_count: sql<number>`count(${shoppingListItems.checked_at})`,
    })
    .from(shoppingLists)
    .leftJoin(
      shoppingListItems,
      eq(shoppingListItems.shopping_list_id, shoppingLists.id),
    )
    .groupBy(shoppingLists.id)
    .orderBy(desc(shoppingLists.created_at), desc(shoppingLists.id));

  // UTC week; fine as a form default.
  const weekStart = startOfWeek(new Date().toISOString().slice(0, 10));

  return {
    lists: lists.map((list) => ({
      ...list,
      label: `${formatDayMonth(list.start_date)} – ${formatDayMonthYear(list.end_date)}`,
    })),
    defaultRange: { start: weekStart, end: addDays(weekStart, 6) },
  };
}

export async function action({ request }: Route.ActionArgs) {
  const db = getDb(env.DB);
  const form = await request.formData();

  const name = String(form.get("name") ?? "").trim();
  const startDate = String(form.get("start_date") ?? "");
  const endDate = String(form.get("end_date") ?? "");

  const errorResponse = (errors: { name?: string; end_date?: string }) =>
    data({ errors }, 422);

  if (name.length > 100) {
    return errorResponse({ name: "Keep the name under 100 characters." });
  }
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return errorResponse({ end_date: "Pick a valid date range." });
  }
  if (endDate < startDate) {
    return errorResponse({
      end_date: "The end date must be on or after the start date.",
    });
  }

  const [list] = await db
    .insert(shoppingLists)
    .values({ name: name === "" ? null : name, start_date: startDate, end_date: endDate })
    .returning();

  await generate(db, list);

  return redirect(`/shopping-lists/${list.id}`);
}

export default function ShoppingListsIndex() {
  const { lists, defaultRange } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const deleteFetcher = useFetcher();

  const [startDate, setStartDate] = useState(defaultRange.start);

  function destroyList(list: { id: number; label: string }) {
    if (confirm(`Delete the list for ${list.label}?`)) {
      deleteFetcher.submit(
        { intent: "delete" },
        { method: "post", action: `/shopping-lists/${list.id}` },
      );
    }
  }

  const inputClass =
    "mt-1 block rounded-lg border border-stone-300 px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-950";

  return (
    <>
      <h1 className="text-2xl font-semibold">Shopping Lists</h1>

      <Form
        method="post"
        className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
      >
        <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
          From
          <input
            type="date"
            name="start_date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-medium text-stone-700 dark:text-stone-300">
          To
          <input
            type="date"
            name="end_date"
            required
            min={startDate}
            defaultValue={defaultRange.end}
            className={inputClass}
          />
        </label>
        <label className="flex-1 text-sm font-medium text-stone-700 dark:text-stone-300">
          Name{" "}
          <span className="font-normal text-stone-400 dark:text-stone-500">
            (optional)
          </span>
          <input
            type="text"
            name="name"
            placeholder="e.g. Week 28 shop"
            className={`${inputClass} w-full`}
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          disabled={navigation.state === "submitting"}
        >
          Generate list
        </button>
        {actionData?.errors?.end_date && (
          <p className="w-full text-sm text-red-600">{actionData.errors.end_date}</p>
        )}
      </Form>
      <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
        Gathers ingredients from every recipe on the calendar in that range. A
        batch that overlaps the range is included in full (you cook the whole
        batch).
      </p>

      {lists.length > 0 ? (
        <div className="mt-6 space-y-2">
          {lists.map((list) => (
            <div
              key={list.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900"
            >
              <Link to={`/shopping-lists/${list.id}`} className="flex-1">
                <span className="font-medium text-stone-800 hover:text-green-700 dark:text-stone-200 dark:hover:text-green-400">
                  {list.name || list.label}
                </span>
                {list.name && (
                  <span className="ml-2 text-sm text-stone-500 dark:text-stone-400">
                    {list.label}
                  </span>
                )}
              </Link>
              <span className="text-sm text-stone-500 dark:text-stone-400">
                {list.checked_items_count}/{list.items_count} ticked
              </span>
              <button
                type="button"
                className="text-sm text-stone-400 hover:text-red-600 dark:text-stone-500 dark:hover:text-red-400"
                onClick={() => destroyList(list)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-10 text-center text-stone-500 dark:text-stone-400">
          No lists yet — pick a date range above and generate one.
        </p>
      )}
    </>
  );
}
