import MarkdownIt from "markdown-it";

// html: false matches Laravel's `html_input: strip`; markdown-it also blocks
// javascript: links by default (the `allow_unsafe_links: false` equivalent).
const md = new MarkdownIt({ html: false });

export function renderMarkdown(markdown: string): string {
  return md.render(markdown);
}
