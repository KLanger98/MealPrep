import { env } from "cloudflare:workers";
import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useSearchParams } from "react-router";
import { and, asc, eq, gte, inArray, isNull, lte, max, min, sql } from "drizzle-orm";
import type { Route } from "./+types/calendar";
import { mealAssignments, recipes } from "../../database/schema";
import {
  AssignmentCard,
  type CalendarAssignment,
} from "../components/assignment-card";
import { AssignmentModal, type ModalContext } from "../components/assignment-modal";
import { SLOTS } from "../lib/config";
import {
  addDays,
  dayNumber,
  formatDayMonth,
  formatDayMonthYear,
  formatWeekdayDay,
  isValidDate,
  localToday,
  startOfWeek,
  weekdayShort,
} from "../lib/dates";
import { getDb } from "../lib/db";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Calendar — Meal Prep" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const db = getDb(env.DB);
  const params = new URL(request.url).searchParams;

  // The Worker runs in UTC, so the client passes ?week= for "today"-relative
  // navigation; without it we fall back to the UTC date.
  const weekParam = params.get("week");
  const reference =
    weekParam && isValidDate(weekParam)
      ? weekParam
      : new Date().toISOString().slice(0, 10);
  const start = startOfWeek(reference);
  const end = addDays(start, 6);

  const rows = await db
    .select({
      id: mealAssignments.id,
      batch_id: mealAssignments.batch_id,
      date: mealAssignments.date,
      slot: mealAssignments.slot,
      scale_factor: mealAssignments.scale_factor,
      recipe_slug: recipes.slug,
      recipe_title: recipes.title,
      recipe_servings: recipes.servings,
      recipe_missing_at: recipes.missing_at,
    })
    .from(mealAssignments)
    .innerJoin(recipes, eq(mealAssignments.recipe_id, recipes.id))
    .where(and(gte(mealAssignments.date, start), lte(mealAssignments.date, end)))
    .orderBy(asc(mealAssignments.date));

  // Span info per batch so cards can show "Mon 7 – Wed 9". A batch can
  // extend beyond this week; use its full range.
  const batchIds = [...new Set(rows.map((r) => r.batch_id))];
  const ranges =
    batchIds.length > 0
      ? await db
          .select({
            batch_id: mealAssignments.batch_id,
            first_date: min(mealAssignments.date),
            last_date: max(mealAssignments.date),
            day_count: sql<number>`count(*)`,
          })
          .from(mealAssignments)
          .where(inArray(mealAssignments.batch_id, batchIds))
          .groupBy(mealAssignments.batch_id)
      : [];
  const rangeByBatch = new Map(ranges.map((r) => [r.batch_id, r]));

  const recipeOptions = await db
    .select({
      id: recipes.id,
      slug: recipes.slug,
      title: recipes.title,
      servings: recipes.servings,
      type: recipes.type,
    })
    .from(recipes)
    .where(isNull(recipes.missing_at))
    .orderBy(asc(recipes.title));

  return {
    weekStart: start,
    weekLabel: `${formatDayMonth(start)} – ${formatDayMonthYear(end)}`,
    days: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return { date, dayName: weekdayShort(date), dayNumber: `${dayNumber(date)} ${formatDayMonth(date).split(" ")[1]}` };
    }),
    slots: [...SLOTS],
    assignments: rows.map((row): CalendarAssignment => {
      const range = rangeByBatch.get(row.batch_id);
      const dayCount = Number(range?.day_count ?? 1);

      return {
        id: row.id,
        batch_id: row.batch_id,
        date: row.date,
        slot: row.slot,
        scale_factor: row.scale_factor,
        batch_days: dayCount,
        batch_range:
          dayCount > 1 && range?.first_date && range?.last_date
            ? `${formatWeekdayDay(range.first_date)} – ${formatWeekdayDay(range.last_date)}`
            : null,
        recipe: {
          slug: row.recipe_slug,
          title: row.recipe_title,
          servings: row.recipe_servings,
          missing: row.recipe_missing_at !== null,
        },
      };
    }),
    recipeOptions,
  };
}

export default function Calendar() {
  const { weekStart, weekLabel, days, slots, assignments, recipeOptions } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const [modalContext, setModalContext] = useState<ModalContext | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  // date -> slot -> assignments
  const grid = new Map<string, Map<string, CalendarAssignment[]>>();
  for (const a of assignments) {
    if (!grid.has(a.date)) grid.set(a.date, new Map());
    const bySlot = grid.get(a.date)!;
    if (!bySlot.has(a.slot)) bySlot.set(a.slot, []);
    bySlot.get(a.slot)!.push(a);
  }

  // "Today" is the browser's date — the server only knows UTC, so resolving
  // it during SSR causes a hydration mismatch whenever the two disagree.
  // Render without a today-highlight and fill it in after mount.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(localToday()), []);

  // The mobile agenda shows one day at a time. A picked day only counts while
  // it's inside the loaded week, so week navigation snaps back to today (or
  // Monday when today is outside the week).
  const weekEnd = addDays(weekStart, 6);
  const inWeek = (date: string) => date >= weekStart && date <= weekEnd;
  const selectedDay =
    pickedDay && inWeek(pickedDay)
      ? pickedDay
      : today && inWeek(today)
        ? today
        : weekStart;

  function goToWeek(offsetDays: number) {
    navigate(`/calendar?week=${addDays(weekStart, offsetDays)}`);
  }

  const navButton =
    "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:hover:bg-stone-800";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <div className="flex items-center gap-2">
          <span className="mr-2 text-sm text-stone-500 dark:text-stone-400">
            {weekLabel}
          </span>
          <button type="button" className={navButton} onClick={() => goToWeek(-7)}>
            ←
          </button>
          <button
            type="button"
            className={navButton}
            onClick={() => setSearchParams({ week: localToday() })}
          >
            Today
          </button>
          <button type="button" className={navButton} onClick={() => goToWeek(7)}>
            →
          </button>
        </div>
      </div>

      {/* Mobile: 7-day strip + one day's agenda. */}
      <div className="mt-4 sm:hidden">
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const hasMeals = (grid.get(day.date)?.size ?? 0) > 0;
            const selected = day.date === selectedDay;
            return (
              <button
                key={day.date}
                type="button"
                className={`relative rounded-lg border py-1.5 text-center ${
                  selected
                    ? "border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950"
                    : "border-transparent bg-stone-100 dark:bg-stone-900"
                }`}
                onClick={() => setPickedDay(day.date)}
              >
                <div
                  className={`text-[10px] font-medium uppercase tracking-wide ${
                    selected
                      ? "text-green-700 dark:text-green-400"
                      : "text-stone-400 dark:text-stone-500"
                  }`}
                >
                  {day.dayName}
                </div>
                <div
                  className={`text-sm font-semibold ${
                    selected
                      ? "text-green-700 dark:text-green-400"
                      : day.date === today
                        ? "text-green-700 dark:text-green-400"
                        : "text-stone-700 dark:text-stone-300"
                  }`}
                >
                  {dayNumber(day.date)}
                </div>
                {hasMeals && !selected && (
                  <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-stone-400 dark:bg-stone-600" />
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 space-y-4">
          {slots.map((slot) => {
            const meals = grid.get(selectedDay)?.get(slot) ?? [];
            return (
              <div key={slot}>
                <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                  {slot}
                </h2>
                <div className="space-y-1.5">
                  {meals.map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      onEdit={(a) => setModalContext({ assignment: a })}
                    />
                  ))}
                  <button
                    type="button"
                    className="w-full rounded-lg border-2 border-dashed border-stone-200 py-2 text-sm font-medium text-stone-400 hover:border-green-400 hover:text-green-600 dark:border-stone-800 dark:text-stone-500 dark:hover:border-green-600 dark:hover:text-green-400"
                    onClick={() => setModalContext({ date: selectedDay, slot })}
                  >
                    <span className="text-green-600 dark:text-green-400">+</span> Add{" "}
                    {slot}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop: full-week grid. */}
      <div className="mt-6 hidden overflow-x-auto sm:block">
        <div className="grid min-w-[900px] grid-cols-[70px_repeat(7,1fr)] gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 dark:border-stone-800 dark:bg-stone-800">
          <div className="bg-stone-50 p-2 dark:bg-stone-900"></div>
          {days.map((day) => (
            <div
              key={day.date}
              className={`p-2 text-center ${
                day.date === today
                  ? "bg-green-50 dark:bg-green-950"
                  : "bg-stone-50 dark:bg-stone-900"
              }`}
            >
              <div className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                {day.dayName}
              </div>
              <div
                className={`text-sm font-semibold ${
                  day.date === today
                    ? "text-green-700 dark:text-green-400"
                    : "text-stone-800 dark:text-stone-200"
                }`}
              >
                {day.dayNumber}
              </div>
            </div>
          ))}

          {slots.map((slot) => (
            <div key={slot} className="contents">
              <div className="flex items-start bg-stone-50 p-2 dark:bg-stone-900">
                <span className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  {slot}
                </span>
              </div>
              {days.map((day) => (
                <div
                  key={slot + day.date}
                  className={`group/cell min-h-24 space-y-1.5 p-1.5 ${
                    day.date === today
                      ? "bg-green-50/40 dark:bg-green-950/30"
                      : "bg-white dark:bg-stone-950"
                  }`}
                >
                  {(grid.get(day.date)?.get(slot) ?? []).map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      onEdit={(a) => setModalContext({ assignment: a })}
                    />
                  ))}
                  <button
                    type="button"
                    className="w-full rounded-md border border-dashed border-stone-200 py-1 text-xs text-stone-300 opacity-0 transition-opacity hover:border-green-400 hover:text-green-600 group-hover/cell:opacity-100 pointer-coarse:opacity-100 dark:border-stone-700 dark:text-stone-600 dark:hover:border-green-500 dark:hover:text-green-400"
                    onClick={() => setModalContext({ date: day.date, slot })}
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {modalContext && (
        <AssignmentModal
          recipes={recipeOptions}
          slots={slots}
          context={modalContext}
          onClose={() => setModalContext(null)}
        />
      )}
    </>
  );
}
