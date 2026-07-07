import { useState } from "react";
import { useFetcher, useRouteLoaderData } from "react-router";
import type { loader as rootLoader } from "../root";

export function SyncErrorBanner() {
  const data = useRouteLoaderData<typeof rootLoader>("root");
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const resync = useFetcher();

  const errors = data?.syncErrors ?? [];

  if (errors.length === 0 || dismissed) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          className="font-medium underline-offset-2 hover:underline"
          onClick={() => setExpanded((e) => !e)}
        >
          {errors.length} recipe {errors.length === 1 ? "file" : "files"} could
          not be read — {expanded ? "hide" : "show"} details
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-amber-700 underline-offset-2 hover:underline dark:text-amber-400"
            disabled={resync.state !== "idle"}
            onClick={() => resync.submit(null, { method: "post", action: "/sync" })}
          >
            {resync.state === "idle" ? "Resync" : "Syncing…"}
          </button>
          <button
            type="button"
            className="text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
          >
            ✕
          </button>
        </div>
      </div>
      {expanded && (
        <ul className="mt-2 space-y-1">
          {errors.map((error) => (
            <li key={error.file + error.message}>
              <span className="font-mono font-medium">{error.file}</span>:{" "}
              {error.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
