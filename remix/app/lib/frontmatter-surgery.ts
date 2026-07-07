// Line-level edits to a recipe file's frontmatter block, used where the app
// changes one field (rating, image) without re-serialising the YAML — the
// file stays the source of truth, formatting and comments intact.
// Ported from RecipeController::rate() / removeFrontmatterKey().

const FRONTMATTER_BLOCK = /^(---\r?\n)([\s\S]*?)(\r?\n---)/;

function replaceFrontmatterLines(
  contents: string,
  edit: (lines: string[]) => string[],
): string | null {
  const m = contents.match(FRONTMATTER_BLOCK);

  if (!m) {
    return null;
  }

  const front = m[2];
  const lines = edit(front.split(/\r\n|\r|\n/));
  const start = m[1].length;

  return (
    contents.slice(0, start) +
    lines.join("\n") +
    contents.slice(start + front.length)
  );
}

/**
 * Set or clear the `rating:` line. Returns null when the file has no
 * frontmatter block.
 */
export function setFrontmatterRating(
  contents: string,
  rating: number | null,
): string | null {
  return replaceFrontmatterLines(contents, (lines) => {
    const kept = lines.filter((line) => !line.startsWith("rating:"));

    if (rating !== null) {
      kept.push(`rating: ${rating % 1 === 0 ? Math.trunc(rating) : rating}`);
    }

    return kept;
  });
}

/**
 * Remove a top-level key's line from the frontmatter block. Returns the
 * contents unchanged when there is no frontmatter or no such line.
 */
export function removeFrontmatterKey(contents: string, key: string): string {
  return (
    replaceFrontmatterLines(contents, (lines) =>
      lines.filter((line) => !line.startsWith(`${key}:`)),
    ) ?? contents
  );
}
