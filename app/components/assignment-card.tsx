import { Link, useFetcher } from "react-router";
import type { PersonOption } from "../lib/people";

export interface CalendarAssignment {
  id: number;
  batch_id: string;
  date: string;
  slot: string;
  scale_factor: number;
  batch_days: number;
  batch_range: string | null;
  recipe: {
    slug: string;
    title: string;
    servings: number;
  };
  people: PersonOption[];
}

/** Who's eating: a compact row of first names. */
export function PeopleBadges({ people }: { people: PersonOption[] }) {
  if (people.length === 0) return null;

  return (
    <>
      {people.map((person) => (
        <span
          key={person.id}
          className="rounded bg-caramel-300/40 px-1 text-[11px] font-normal text-caramel-600 dark:bg-caramel-600/30 dark:text-caramel-300"
        >
          {person.name}
        </span>
      ))}
    </>
  );
}

export interface RecipeOption {
  id: number;
  slug: string;
  title: string;
  servings: number;
  type: string;
}

export function AssignmentCard({
  assignment,
  onEdit,
}: {
  assignment: CalendarAssignment;
  onEdit: (assignment: CalendarAssignment) => void;
}) {
  const remove = useFetcher();

  function removeDay() {
    remove.submit(null, {
      method: "delete",
      action: `/assignments/${assignment.id}`,
    });
  }

  function removeBatch() {
    if (
      assignment.batch_days > 1 &&
      !confirm(
        `Remove "${assignment.recipe.title}" from all ${assignment.batch_days} days?`,
      )
    ) {
      return;
    }
    remove.submit(null, {
      method: "delete",
      action: `/assignments/batch/${assignment.batch_id}`,
    });
  }

  return (
    <div className="group rounded-lg border border-stone-200 bg-paper p-2 text-xs shadow-sm dark:border-stone-700 dark:bg-stone-900">
      <div className="flex items-start justify-between gap-1">
        <Link
          to={`/recipes/${assignment.recipe.slug}`}
          className="font-medium text-stone-800 hover:text-accent-700 dark:text-stone-200 dark:hover:text-accent-400"
        >
          {assignment.recipe.title}
        </Link>
        <button
          type="button"
          className="hidden shrink-0 text-stone-400 hover:text-red-600 group-hover:block pointer-coarse:block dark:text-stone-500 dark:hover:text-red-400"
          title={assignment.batch_days > 1 ? "Remove this day only" : "Remove"}
          aria-label="Remove this day"
          onClick={removeDay}
        >
          ✕
        </button>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400">
        {assignment.scale_factor !== 1 && (
          <span className="rounded bg-accent-50 px-1 font-medium text-accent-700 dark:bg-accent-950 dark:text-accent-300">
            ×{assignment.scale_factor}
          </span>
        )}
        {assignment.batch_range && (
          <span
            className="rounded bg-blue-50 px-1 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            title="This batch covers multiple days"
          >
            {assignment.batch_range}
          </span>
        )}
        <PeopleBadges people={assignment.people} />
      </div>

      <div className="mt-1 hidden gap-2 group-hover:flex pointer-coarse:flex">
        <button
          type="button"
          className="text-[11px] text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
          onClick={() => onEdit(assignment)}
        >
          Edit batch
        </button>
        {assignment.batch_days > 1 && (
          <button
            type="button"
            className="text-[11px] text-stone-400 hover:text-red-600 dark:text-stone-500 dark:hover:text-red-400"
            onClick={removeBatch}
          >
            Remove all days
          </button>
        )}
      </div>
    </div>
  );
}
