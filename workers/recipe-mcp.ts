import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { z } from "zod";
import { asc, eq, isNull } from "drizzle-orm";
import schemaMd from "../recipes/SCHEMA.md?raw";
import { recipes } from "../database/schema";
import { getDb } from "../app/lib/db";
import { createRecipe } from "../app/lib/recipe-creator";
import { recipeToMarkdown } from "../app/lib/recipe-serializer";
import { listKnownIngredients, loadIngredients } from "../app/lib/recipe-store";

const APP_URL = "https://meal-prep.karl-w-langer.workers.dev";

const text = (value: string) => ({
  content: [{ type: "text" as const, text: value }],
});

const errorText = (value: string) => ({
  content: [{ type: "text" as const, text: value }],
  isError: true,
});

/**
 * Remote MCP server exposing the recipe store to Claude (via a claude.ai
 * custom connector). The heavy lifting — extracting a recipe from a URL or
 * photo and composing the .md — happens on Claude's side, guided by the
 * recipe-clipper skill; these tools validate and persist.
 */
export class RecipeMcp extends McpAgent<Env> {
  server = new McpServer({ name: "meal-prep", version: "1.0.0" });

  async init() {
    const db = getDb(this.env.DB);

    this.server.registerTool(
      "get_recipe_context",
      {
        description:
          "The recipe file format (SCHEMA.md) plus the live vocabulary of this recipe collection: existing ingredient names, tags, types, proteins and slugs. Call this before composing a recipe — reusing the exact existing ingredient names matters because shopping lists merge by name.",
        inputSchema: {},
      },
      async () => {
        const rows = await db
          .select({
            slug: recipes.slug,
            type: recipes.type,
            protein: recipes.protein,
            tags: recipes.tags,
          })
          .from(recipes)
          .where(isNull(recipes.missing_at));

        const known = await listKnownIngredients(db);

        const distinct = (values: (string | null)[]) =>
          [...new Set(values.filter((v): v is string => v !== null))].sort();

        const vocabulary = {
          ingredient_names: known.map((i) => i.name),
          tags: distinct(rows.flatMap((r) => r.tags ?? [])),
          types: distinct(rows.map((r) => r.type)),
          proteins: distinct(rows.map((r) => r.protein)),
          existing_slugs: rows.map((r) => r.slug).sort(),
        };

        return {
          content: [
            { type: "text" as const, text: schemaMd },
            {
              type: "text" as const,
              text: `Existing vocabulary (reuse these names where they fit):\n${JSON.stringify(vocabulary, null, 2)}`,
            },
          ],
        };
      },
    );

    this.server.registerTool(
      "create_recipe",
      {
        description:
          "Create a new recipe from a complete recipe document (YAML frontmatter + markdown body, per get_recipe_context's schema). Returns the recipe URL, or a validation error message you should fix and retry.",
        inputSchema: {
          content: z
            .string()
            .describe("Full recipe document: YAML frontmatter + markdown body"),
        },
      },
      async ({ content }) => {
        const result = await createRecipe(db, this.env.RECIPES, content);

        if (!result.ok) {
          return errorText(result.error);
        }

        return text(
          JSON.stringify({
            slug: result.slug,
            url: `${APP_URL}/recipes/${result.slug}`,
            warnings: result.warnings,
          }),
        );
      },
    );

    this.server.registerTool(
      "list_recipes",
      {
        description: "List all recipes: slug, title, type, protein, rating.",
        inputSchema: {},
      },
      async () => {
        const rows = await db
          .select({
            slug: recipes.slug,
            title: recipes.title,
            type: recipes.type,
            protein: recipes.protein,
            rating: recipes.rating,
          })
          .from(recipes)
          .where(isNull(recipes.missing_at))
          .orderBy(asc(recipes.title));

        return text(JSON.stringify(rows, null, 2));
      },
    );

    this.server.registerTool(
      "get_recipe",
      {
        description:
          "Fetch a recipe by slug, rendered in the same format create_recipe accepts.",
        inputSchema: { slug: z.string() },
      },
      async ({ slug }) => {
        const rows = await db
          .select()
          .from(recipes)
          .where(eq(recipes.slug, slug))
          .limit(1);

        if (!rows[0]) {
          return errorText(`No recipe found with slug "${slug}".`);
        }

        return text(
          recipeToMarkdown(rows[0], await loadIngredients(db, rows[0].id)),
        );
      },
    );
  }
}
