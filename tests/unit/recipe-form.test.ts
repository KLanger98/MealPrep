import { describe, expect, it } from "vitest";
import { parseRecipeForm } from "../../app/lib/recipe-form";

function form(overrides: Record<string, string> = {}, rows: object[] | null = null) {
  const data = new FormData();
  const values: Record<string, string> = {
    title: "Beef Chilli",
    slug: "",
    type: "dinner",
    servings: "4",
    cost: "medium",
    protein: "Beef",
    source: "",
    prep_minutes: "15",
    cook_minutes: "",
    tags: "freezes-well, spicy ,",
    body_markdown: "## Method\n\n1. Cook.",
    ingredients: JSON.stringify(
      rows ?? [{ name: "Beef Mince ", quantity: "500", unit: "grams", note: "", category: "meat" }],
    ),
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("parseRecipeForm", () => {
  it("normalises a valid submission", () => {
    const result = parseRecipeForm(form());

    expect(result).toEqual({
      ok: true,
      slug: "beef-chilli",
      fields: {
        title: "Beef Chilli",
        type: "dinner",
        protein: "beef",
        cost: "medium",
        source: null,
        prep_minutes: 15,
        cook_minutes: null,
        servings: 4,
        tags: ["freezes-well", "spicy"],
        body_markdown: "## Method\n\n1. Cook.",
      },
      ingredients: [
        { name: "beef mince", quantity: 500, unit: "g", note: null, category: "meat" },
      ],
    });
  });

  it("keeps the existing slug when editing", () => {
    const result = parseRecipeForm(form({ title: "Renamed", slug: "ignored" }), "beef-chilli");
    expect(result.ok && result.slug).toBe("beef-chilli");
  });

  it("accepts fractions, skips blank rows and drops the unit of unquantified items", () => {
    const result = parseRecipeForm(
      form({}, [
        { name: "limes", quantity: "1 1/2", unit: "whole" },
        { name: "", quantity: "", unit: "g" },
        { name: "salt", quantity: "", unit: "tsp", note: "to taste" },
      ]),
    );

    expect(result.ok && result.ingredients).toEqual([
      { name: "limes", quantity: 1.5, unit: "whole", note: null, category: null },
      { name: "salt", quantity: null, unit: null, note: "to taste", category: null },
    ]);
  });

  it("reports every problem at once", () => {
    const result = parseRecipeForm(
      form({ title: "", servings: "0", type: "brunch", prep_minutes: "1.5" }, [
        { name: "rice", quantity: "a lot" },
      ]),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        "ingredients", "prep_minutes", "servings", "title", "type",
      ]);
      expect(result.errors.ingredients).toContain('"a lot"');
    }
  });

  it("requires at least one ingredient", () => {
    const result = parseRecipeForm(form({}, []));
    expect(!result.ok && result.errors.ingredients).toBe("Add at least one ingredient.");
  });
});
