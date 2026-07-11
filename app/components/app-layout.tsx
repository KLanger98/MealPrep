import { Link, NavLink } from "react-router";
import { useTheme, type Theme } from "../lib/theme";
import { SyncErrorBanner } from "./sync-error-banner";

const NAV_ITEMS = [
  { label: "Recipes", href: "/recipes" },
  { label: "Calendar", href: "/calendar" },
  { label: "Shopping Lists", href: "/shopping-lists" },
];

const THEME_ICONS: Record<Theme, string> = { system: "◐", light: "☀️", dark: "🌙" };
const THEME_LABELS: Record<Theme, string> = {
  system: "Theme: auto (follows system)",
  light: "Theme: light",
  dark: "Theme: dark",
};

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, cycle } = useTheme();

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3 sm:px-6">
          <Link
            to="/recipes"
            className="flex items-center gap-2 text-lg font-semibold text-green-700 dark:text-green-400"
          >
            <span aria-hidden="true">🥘</span>
            <span>Meal Prep</span>
          </Link>
          <nav className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.label}
                to={item.href}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            className="ml-auto rounded-md px-2 py-1 text-sm text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            title={THEME_LABELS[theme]}
            aria-label={THEME_LABELS[theme]}
            onClick={cycle}
          >
            {THEME_ICONS[theme]}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <SyncErrorBanner />
        {children}
      </main>
    </div>
  );
}
