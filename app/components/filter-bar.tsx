import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";

export interface FilterOptions {
  types: string[];
  proteins: string[];
  costs: string[];
  tags: string[];
}

const FILTER_KEYS = ["q", "type", "protein", "cost", "tag"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export function FilterBar({ options }: { options: FilterOptions }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const current = Object.fromEntries(
    FILTER_KEYS.map((k) => [k, searchParams.get(k) ?? ""]),
  ) as Record<FilterKey, string>;

  // Search input is locally controlled so typing isn't janky; it syncs to
  // the URL after a 300ms debounce.
  const [q, setQ] = useState(current.q);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  function updateParams(changes: Partial<Record<FilterKey, string>>) {
    const next = { ...current, ...changes };
    const params = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v !== ""),
    );
    setSearchParams(params, { replace: true, preventScrollReset: true });
  }

  function onSearchInput(value: string) {
    setQ(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => updateParams({ q: value }), 300);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const hasFilters = q !== "" || FILTER_KEYS.some((k) => current[k] !== "");

  function clearAll() {
    if (timer.current) clearTimeout(timer.current);
    setQ("");
    setSearchParams({}, { replace: true, preventScrollReset: true });
  }

  const selectClass =
    "rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm dark:border-stone-700 dark:bg-stone-900";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={q}
        onChange={(e) => onSearchInput(e.target.value)}
        placeholder="Search recipes or ingredients…"
        className="w-64 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-stone-700 dark:bg-stone-900"
      />
      <select
        value={current.type}
        onChange={(e) => updateParams({ type: e.target.value })}
        className={`${selectClass} capitalize`}
      >
        <option value="">All types</option>
        {options.types.map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <select
        value={current.protein}
        onChange={(e) => updateParams({ protein: e.target.value })}
        className={`${selectClass} capitalize`}
      >
        <option value="">All proteins</option>
        {options.proteins.map((protein) => (
          <option key={protein} value={protein}>{protein}</option>
        ))}
      </select>
      <select
        value={current.cost}
        onChange={(e) => updateParams({ cost: e.target.value })}
        className={selectClass}
      >
        <option value="">Any cost</option>
        {options.costs.map((cost) => (
          <option key={cost} value={cost}>{cost}</option>
        ))}
      </select>
      <select
        value={current.tag}
        onChange={(e) => updateParams({ tag: e.target.value })}
        className={selectClass}
      >
        <option value="">All tags</option>
        {options.tags.map((tag) => (
          <option key={tag} value={tag}>{tag}</option>
        ))}
      </select>
      {hasFilters && (
        <button
          type="button"
          className="text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
          onClick={clearAll}
        >
          Clear
        </button>
      )}
    </div>
  );
}
