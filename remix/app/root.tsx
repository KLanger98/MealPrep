import { env } from "cloudflare:workers";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { eq } from "drizzle-orm";

import type { Route } from "./+types/root";
import { recipeImportErrors } from "../database/schema";
import { AppLayout } from "./components/app-layout";
import { getDb } from "./lib/db";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.bunny.net" },
  {
    rel: "stylesheet",
    href: "https://fonts.bunny.net/css?family=instrument-sans:400,500,600",
  },
];

// Shared across all pages (the Inertia shared-props equivalent): recipe
// files that failed to parse on the last sync, surfaced by SyncErrorBanner.
export async function loader() {
  const errors = await getDb(env.DB)
    .select({
      file: recipeImportErrors.r2_key,
      message: recipeImportErrors.message,
    })
    .from(recipeImportErrors)
    .where(eq(recipeImportErrors.level, "error"));

  return { syncErrors: errors };
}

// Apply the theme before first paint to avoid a flash of the wrong mode.
const themeScript = `(() => {
  const theme = localStorage.getItem('theme');
  const dark = theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
})();`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the pre-paint theme script may add .dark before React hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Meta />
        <Links />
      </head>
      <body className="bg-stone-50 font-sans text-stone-900 antialiased dark:bg-stone-950 dark:text-stone-100">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pt-16">
      <h1 className="text-2xl font-semibold">{message}</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">{details}</p>
      {stack && (
        <pre className="mt-4 w-full overflow-x-auto rounded-lg bg-stone-100 p-4 text-sm dark:bg-stone-900">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
