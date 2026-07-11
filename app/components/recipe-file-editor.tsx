import { Form } from "react-router";

export function RecipeFileEditor({
  content,
  onChange,
  error,
  processing = false,
  submitLabel = "Save",
}: {
  content: string;
  onChange: (value: string) => void;
  error?: string | null;
  processing?: boolean;
  submitLabel?: string;
}) {
  return (
    <Form method="post" className="mt-4">
      {error && (
        <div className="mb-3 whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <textarea
        name="content"
        value={content}
        rows={26}
        spellCheck={false}
        className="w-full rounded-xl border border-stone-300 bg-white p-4 font-mono text-sm leading-relaxed focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-stone-700 dark:bg-stone-900"
        onChange={(e) => onChange(e.target.value)}
      />

      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-xs text-stone-500 dark:text-stone-400">
          YAML frontmatter + Markdown method — the format is documented in{" "}
          <span className="font-mono">recipes/SCHEMA.md</span>.
        </p>
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          disabled={processing}
        >
          {submitLabel}
        </button>
      </div>
    </Form>
  );
}
