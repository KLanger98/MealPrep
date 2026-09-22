import { env } from "cloudflare:workers";
import { useEffect, useRef } from "react";
import { data, useFetcher, useLoaderData } from "react-router";
import { eq, sql } from "drizzle-orm";
import type { Route } from "./+types/people";
import { people } from "../../database/schema";
import { getDb } from "../lib/db";
import { MAX_PERSON_NAME_CHARS } from "../lib/people";

export function meta({}: Route.MetaArgs) {
  return [{ title: "People — Meal Prep" }];
}

export async function loader({}: Route.LoaderArgs) {
  const rows = await getDb(env.DB)
    .select({
      id: people.id,
      name: people.name,
      // Raw names: drizzle drops table prefixes in a single-table select.
      meals: sql<number>`(
        select count(*) from meal_assignment_people map
        where map.person_id = people.id
      )`,
    })
    .from(people)
    .orderBy(people.name);

  return { people: rows };
}

function cleanName(raw: FormDataEntryValue | null): string {
  return typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
}

export async function action({ request }: Route.ActionArgs) {
  const db = getDb(env.DB);
  const form = await request.formData();
  const intent = form.get("intent");
  const id = Number(form.get("id"));

  if (intent === "delete") {
    // Their meal assignments cascade away; the meals themselves stay.
    await db.delete(people).where(eq(people.id, id));
    return { ok: true };
  }

  if (intent === "add" || intent === "rename") {
    const name = cleanName(form.get("name"));

    if (name === "") {
      return data({ errors: { name: "Enter a name." } }, 422);
    }
    if (name.length > MAX_PERSON_NAME_CHARS) {
      return data({ errors: { name: "That name is too long." } }, 422);
    }

    const clash = await db
      .select({ id: people.id })
      .from(people)
      .where(sql`lower(${people.name}) = ${name.toLowerCase()}`)
      .limit(1);

    if (clash.length > 0 && clash[0].id !== id) {
      return data({ errors: { name: `${name} is already in the household.` } }, 422);
    }

    if (intent === "add") {
      await db.insert(people).values({ name });
    } else {
      await db.update(people).set({ name }).where(eq(people.id, id));
    }

    return { ok: true };
  }

  throw data(null, 400);
}

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-paper px-3 py-2 text-sm focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500 dark:border-stone-700 dark:bg-stone-900";

type ActionData = { ok?: boolean; errors?: { name?: string } };

function PersonRow({ person }: { person: { id: number; name: string; meals: number } }) {
  const fetcher = useFetcher<ActionData>();

  function remove() {
    const warning =
      person.meals > 0
        ? `Remove ${person.name}? They'll be taken off ${person.meals} planned meal${person.meals === 1 ? "" : "s"}.`
        : `Remove ${person.name}?`;
    if (confirm(warning)) {
      fetcher.submit({ intent: "delete", id: person.id }, { method: "post" });
    }
  }

  return (
    <li className="rounded-xl border border-stone-200 bg-paper p-3 dark:border-stone-800 dark:bg-stone-900">
      <fetcher.Form method="post" className="flex items-center gap-2">
        <input type="hidden" name="intent" value="rename" />
        <input type="hidden" name="id" value={person.id} />
        <input
          name="name"
          aria-label="Name"
          defaultValue={person.name}
          maxLength={MAX_PERSON_NAME_CHARS}
          className={inputClass}
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-800"
        >
          Rename
        </button>
        <button
          type="button"
          className="shrink-0 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          onClick={remove}
        >
          Remove
        </button>
      </fetcher.Form>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
        {person.meals === 0
          ? "No meals planned"
          : `On ${person.meals} planned meal${person.meals === 1 ? "" : "s"}`}
      </p>
      {fetcher.data?.errors?.name && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{fetcher.data.errors.name}</p>
      )}
    </li>
  );
}

export default function People() {
  const { people } = useLoaderData<typeof loader>();
  const add = useFetcher<ActionData>();
  const addForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (add.state === "idle" && add.data?.ok) addForm.current?.reset();
  }, [add.state, add.data]);

  return (
    <>
      <h1 className="text-2xl font-semibold">People</h1>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Everyone in the household. Pick who's eating when you add a meal to
        the calendar. Everyone shares the same login.
      </p>

      <add.Form ref={addForm} method="post" className="mt-4 flex max-w-md gap-2">
        <input type="hidden" name="intent" value="add" />
        <input
          name="name"
          aria-label="New person's name"
          placeholder="Name"
          maxLength={MAX_PERSON_NAME_CHARS}
          className={inputClass}
          required
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
          disabled={add.state !== "idle"}
        >
          Add
        </button>
      </add.Form>
      {add.data?.errors?.name && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{add.data.errors.name}</p>
      )}

      {people.length > 0 ? (
        <ul className="mt-6 max-w-md space-y-3">
          {people.map((person) => (
            <PersonRow key={person.id} person={person} />
          ))}
        </ul>
      ) : (
        <p className="mt-10 text-sm text-stone-500 dark:text-stone-400">
          Nobody yet — add the people you cook for.
        </p>
      )}
    </>
  );
}
