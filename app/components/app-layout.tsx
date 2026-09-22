import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { useSwipeNavigation } from "../lib/swipe-navigation";
import { useTheme, type Theme } from "../lib/theme";
import { LogoMark } from "./logo";

const NAV_ITEMS = [
  { label: "Recipes", shortLabel: "Recipes", href: "/recipes", icon: BookIcon },
  { label: "Calendar", shortLabel: "Calendar", href: "/calendar", icon: CalendarIcon },
  { label: "Shopping Lists", shortLabel: "Shopping", href: "/shopping-lists", icon: CartIcon },
];

// Rarely-visited pages live in the header's settings menu, not the main nav.
// Swipe order on mobile: left-to-right as the bottom bar shows them.
const SWIPE_PAGES = NAV_ITEMS.map((item) => item.href);

const SETTINGS_ITEMS = [{ label: "People", href: "/people", icon: PeopleIcon }];

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

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <path d="M16 4.5a4 4 0 0 1 0 7M18 14.5a7 7 0 0 1 4 6.5" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const active = SETTINGS_ITEMS.some((item) => location.pathname.startsWith(item.href));

  // Navigating (including via a menu item) closes the menu.
  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        className={`rounded-md p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 ${
          active
            ? "text-accent-700 dark:text-accent-400"
            : "text-stone-500 dark:text-stone-400"
        }`}
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <GearIcon className="size-5" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-44 rounded-xl border border-stone-200 bg-paper p-1 shadow-lg dark:border-stone-700 dark:bg-stone-900"
        >
          {SETTINGS_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              role="menuitem"
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  isActive
                    ? "bg-accent-50 font-medium text-accent-800 dark:bg-accent-950 dark:text-accent-300"
                    : "text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                }`
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { theme, cycle } = useTheme();
  const main = useRef<HTMLElement>(null);
  useSwipeNavigation(main, SWIPE_PAGES);

  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-paper dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-3 sm:px-6">
          <Link
            to="/recipes"
            className="flex items-center gap-2 text-lg font-semibold text-accent-700 dark:text-accent-400"
          >
            <LogoMark className="size-7" />
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
                      ? "bg-accent-50 text-accent-800 dark:bg-accent-950 dark:text-accent-300"
                      : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="rounded-md px-2 py-1 text-sm text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
              title={THEME_LABELS[theme]}
              aria-label={THEME_LABELS[theme]}
              onClick={cycle}
            >
              {THEME_ICONS[theme]}
            </button>
            <SettingsMenu />
          </div>
        </div>
      </header>

      <main ref={main} className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:pb-6">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-paper pb-[env(safe-area-inset-bottom)] sm:hidden dark:border-stone-800 dark:bg-stone-900"
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
                  <div
                    className={`rounded-xl p-2 transition-colors flex flex-col items-center gap-1 ${
                      isActive
                        ? "bg-accent-50 text-accent-700 dark:bg-accent-950 dark:text-accent-400"
                        : "text-stone-500 dark:text-stone-400"
                    }`}
                  >
                    <item.icon className="h-[22px] w-[22px]" />
                  <span
                    className={
                        isActive
                        ? "text-accent-700 dark:text-accent-400"
                        : "text-stone-500 dark:text-stone-400"
                    }
                    >
                    {item.shortLabel}
                  </span>
                </div>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
