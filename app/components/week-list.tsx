import type { CalendarAssignment } from "./assignment-card";

interface WeekListProps {
  days: { date: string; dayName: string; dayNumber: string }[];
  slots: string[];
  // date -> slot -> assignments
  grid: Map<string, Map<string, CalendarAssignment[]>>;
  today: string | null;
  onAdd: (date: string, slot?: string) => void;
  onEdit: (assignment: CalendarAssignment) => void;
}

const addButton =
  "ml-auto shrink-0 rounded-md border border-dashed border-stone-300 px-2 py-0.5 text-xs text-stone-400 hover:border-accent-400 hover:text-accent-600 dark:border-stone-700 dark:text-stone-500 dark:hover:border-accent-500 dark:hover:text-accent-400";

/** Calendar list view: the week as stacked day cards, one row per slot. */
export function WeekList({ days, slots, grid, today, onAdd, onEdit }: WeekListProps) {
  return (
    <div className="space-y-2">
      {days.map((day) => {
        const bySlot = grid.get(day.date);
        const isToday = day.date === today;
        const [dayOfMonth, month] = day.dayNumber.split(" ");

        return (
          <section
            key={day.date}
            className="overflow-hidden rounded-xl border border-stone-200 bg-paper sm:grid sm:grid-cols-[72px_minmax(0,1fr)] dark:border-stone-800 dark:bg-stone-900"
          >
            {/* Date: a header bar on mobile, a left-hand block from sm up. */}
            <h2
              className={`flex items-baseline gap-1.5 border-b border-stone-200 px-3 py-1.5 sm:block sm:border-b-0 sm:border-r sm:px-0 sm:py-2.5 sm:text-center dark:border-stone-800 ${
                isToday
                  ? "bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-400"
                  : "bg-stone-50 text-stone-800 dark:bg-stone-950 dark:text-stone-200"
              }`}
            >
              <span
                className={`text-sm font-semibold sm:block sm:text-[10px] sm:font-medium sm:uppercase sm:tracking-wide ${
                  isToday ? "" : "sm:text-stone-500 dark:sm:text-stone-400"
                }`}
              >
                {day.dayName}
              </span>
              <span className="text-sm font-semibold sm:block sm:text-lg">{dayOfMonth}</span>
              <span className="text-sm font-semibold sm:hidden">{month}</span>
              {isToday && <span className="ml-auto text-xs font-medium sm:hidden">Today</span>}
            </h2>

            {bySlot ? (
              <div className="divide-y divide-stone-100 dark:divide-stone-800">
                {slots.map((slot) => (
                  <div key={slot} className="flex min-h-9 flex-wrap items-center gap-1.5 px-3 py-1.5">
                    <span className="w-18 shrink-0 text-[10px] font-medium uppercase tracking-widest text-stone-400 dark:text-stone-500">
                      {slot}
                    </span>
                    {(bySlot.get(slot) ?? []).map((assignment) => (
                      <MealChip key={assignment.id} assignment={assignment} onEdit={onEdit} />
                    ))}
                    <button
                      type="button"
                      className={addButton}
                      aria-label={`Add ${slot} on ${day.dayName} ${day.dayNumber}`}
                      onClick={() => onAdd(day.date, slot)}
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center px-3 py-2 text-xs text-stone-400 dark:text-stone-500">
                Nothing planned
                <button type="button" className={addButton} onClick={() => onAdd(day.date)}>
                  + Add meal
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function MealChip({
  assignment,
  onEdit,
}: {
  assignment: CalendarAssignment;
  onEdit: (assignment: CalendarAssignment) => void;
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-paper px-2 py-1 text-left text-xs font-medium text-stone-800 hover:border-accent-400 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:border-accent-600"
      title="Edit batch"
      onClick={() => onEdit(assignment)}
    >
      {assignment.recipe.title}
      {assignment.scale_factor !== 1 && (
        <span className="rounded bg-accent-50 px-1 text-[11px] text-accent-700 dark:bg-accent-950 dark:text-accent-300">
          ×{assignment.scale_factor}
        </span>
      )}
      {assignment.batch_range && (
        <span className="rounded bg-blue-50 px-1 text-[11px] font-normal text-blue-700 dark:bg-blue-950 dark:text-blue-300">
          {assignment.batch_range}
        </span>
      )}
      {assignment.recipe.missing && (
        <span className="rounded bg-red-50 px-1 text-[11px] font-normal text-red-700 dark:bg-red-950 dark:text-red-300">
          file missing
        </span>
      )}
    </button>
  );
}
