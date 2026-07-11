import { Link, NavLink } from "react-router";
import { useTheme, type Theme } from "../lib/theme";
import { SyncErrorBanner } from "./sync-error-banner";

const NAV_ITEMS = [
  { label: "Recipes", shortLabel: "Recipes", href: "/recipes", icon: BookIcon },
  { label: "Calendar", shortLabel: "Calendar", href: "/calendar", icon: CalendarIcon },
  { label: "Shopping Lists", shortLabel: "Shopping", href: "/shopping-lists", icon: CartIcon },
];

const THEME_ICONS: Record<Theme, string> = { system: "◐", light: "☀️", dark: "🌙" };
const THEME_LABELS: Record<Theme, string> = {
  system: "Theme: auto (follows system)",
  light: "Theme: light",
  dark: "Theme: dark",
};

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13Z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
    </svg>
  );
}

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
          <nav className="hidden gap-1 sm:flex">
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

      <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:pb-6">
        <SyncErrorBanner />
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden dark:border-stone-800 dark:bg-stone-900"
        aria-label="Primary"
      >
        <div className="grid grid-cols-3 px-2 py-1.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.label}
              to={item.href}
              className="flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`rounded-full px-4 py-0.5 transition-colors ${
                      isActive
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
                        : "text-stone-500 dark:text-stone-400"
                    }`}
                  >
                    <item.icon className="h-[22px] w-[22px]" />
                  </span>
                  <span
                    className={
                      isActive
                        ? "text-green-700 dark:text-green-400"
                        : "text-stone-500 dark:text-stone-400"
                    }
                  >
                    {item.shortLabel}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
