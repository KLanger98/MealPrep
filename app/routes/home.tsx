import { env } from "cloudflare:workers";
import { useEffect } from "react";
import { Link, useLoaderData, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/home";
import { PeopleBadges } from "../components/assignment-card";
import { RecipeCard } from "../components/recipe-card";
import { SLOTS } from "../lib/config";
import { loadDashboard, type TodayMeal } from "../lib/dashboard";
import { dayName, formatLongDate, isValidDate, localToday } from "../lib/dates";
import { getDb } from "../lib/db";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Today — Meal Prep" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  // The Worker runs in UTC, so the browser passes its own ?date= whenever
  // the two disagree (see the effect below).
  const dateParam = new URL(request.url).searchParams.get("date");
  const date =
    dateParam && isValidDate(dateParam)
      ? dateParam
      : new Date().toISOString().slice(0, 10);

  return loadDashboard(getDb(env.DB), date);
}

function MealCard({ meal }: { meal: TodayMeal }) {
  return (
    <Link
      to={`/recipes/${meal.recipe.slug}`}
      className="flex items-center gap-3 overflow-hidden rounded-xl border border-stone-200 bg-paper p-2 transition-shadow hover:shadow-md dark:border-stone-800 dark:bg-stone-900 dark:hover:shadow-stone-900"
    >
      {meal.recipe.image_url ? (
        <img
          src={meal.recipe.image_url}
          alt=""
          className="size-16 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-2xl dark:bg-stone-800">
          🍽️
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate font-semibold text-stone-900 dark:text-stone-100">
          {meal.recipe.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
          {meal.recipe.total_minutes && <span>{meal.recipe.total_minutes} min</span>}
          {meal.scale_factor !== 1 && (
            <span className="rounded bg-accent-50 px-1 font-medium text-accent-700 dark:bg-accent-950 dark:text-accent-300">
              ×{meal.scale_factor}
            </span>
          )}
          <PeopleBadges people={meal.people} />
        </div>
      </div>
    </Link>
  );
}

export default function Home() {
  const { date, meals, recentRecipes } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Server-rendered with the UTC date; if the browser's day differs (e.g.
  // early morning in Australia), reload with the local one.
  useEffect(() => {
    const today = localToday();
    if (!searchParams.has("date") && today !== date) {
      navigate(`/?date=${today}`, { replace: true });
    }
  }, [date, searchParams, navigate]);

  const slots = [
    ...SLOTS,
    ...new Set(meals.map((m) => m.slot).filter((s) => !(SLOTS as readonly string[]).includes(s))),
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
            {dayName(date)}, {formatLongDate(date)}
          </p>
          <h1 className="text-2xl font-semibold">Today's meals</h1>
        </div>
        <Link
          to={`/calendar?week=${date}`}
          className="text-sm font-medium text-accent-700 hover:underline dark:text-accent-400"
        >
          View week →
        </Link>
      </div>

      {meals.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {slots.map((slot) => {
            const inSlot = meals.filter((m) => m.slot === slot);
            return (
              <section key={slot}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
                  {slot}
                </h2>
                {inSlot.length > 0 ? (
                  <div className="space-y-2">
                    {inSlot.map((meal) => (
                      <MealCard key={meal.id} meal={meal} />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-stone-300 px-3 py-5 text-center text-sm text-stone-400 dark:border-stone-700 dark:text-stone-500">
                    Nothing planned
                  </p>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-stone-300 px-4 py-8 text-center text-stone-500 dark:border-stone-700 dark:text-stone-400">
          <p className="font-medium">Nothing planned for today</p>
          <Link
            to={`/calendar?week=${date}`}
            className="mt-2 inline-block text-sm font-medium text-accent-700 hover:underline dark:text-accent-400"
          >
            Plan some meals in the calendar
          </Link>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Recently added</h2>
        <Link
          to="/recipes"
          className="text-sm font-medium text-accent-700 hover:underline dark:text-accent-400"
        >
          All recipes →
        </Link>
      </div>

      {recentRecipes.length > 0 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentRecipes.map((recipe) => (
            <RecipeCard key={recipe.slug} recipe={recipe} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
          No recipes yet —{" "}
          <Link to="/recipes/new" className="font-medium text-accent-700 hover:underline dark:text-accent-400">
            add your first one
          </Link>
          .
        </p>
      )}
    </>
  );
}
