import { describe, expect, it } from "vitest";
import { parseRecipe, RecipeParseError } from "../../app/lib/recipe-parser";

// Ported from tests/Unit/RecipeFileParserTest.php. The PHP tests write temp
// files; here we parse strings directly (the PHP class's parseString path).
describe("parseRecipe", () => {
  it("parses a full recipe", () => {
    const result = parseRecipe(
      `---
title: Test Bowl
slug: test-bowl
type: Dinner
servings: 4
protein: Chicken
cost: low
prep_minutes: 10
tags: [quick, easy]
custom_field: hello
ingredients:
  - name: rice
    quantity: 1 1/2
    unit: cup
  - name: salt
    note: to taste
  - garlic
---
## Method
Cook it.`,
      "test",
    );
    const data = result.data;

    expect(data.slug).toBe("test-bowl");
    expect(data.title).toBe("Test Bowl");
    expect(data.type).toBe("dinner");
    expect(data.protein).toBe("chicken");
    expect(data.servings).toBe(4);
    expect(data.tags).toEqual(["quick", "easy"]);
    expect(data.meta).toEqual({ custom_field: "hello" });
    expect(data.ingredients).toHaveLength(3);
    expect(data.ingredients[0].quantity).toBe(1.5);
    expect(data.ingredients[1].quantity).toBeNull();
    expect(data.ingredients[1].note).toBe("to taste");
    expect(data.ingredients[2].name).toBe("garlic");
    expect(data.body_markdown).toContain("Cook it.");
    expect(result.warnings).toEqual([]);
  });

  it("slug falls back to filename with warning", () => {
    const result = parseRecipe(
      `---
title: Curry
servings: 2
ingredients:
  - name: rice
---
`,
      "My Great Curry",
    );

    expect(result.data.slug).toBe("my-great-curry");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("missing servings defaults to one with warning", () => {
    const result = parseRecipe(
      `---
title: X
slug: x
ingredients:
  - name: rice
---
`,
      "x",
    );

    expect(result.data.servings).toBe(1);
    expect(result.warnings.join(" ")).toContain("servings");
  });

  it("missing title throws", () => {
    expect(() =>
      parseRecipe(
        `---
slug: x
---
Body`,
        "x",
      ),
    ).toThrow(RecipeParseError);
  });

  it("no frontmatter throws", () => {
    expect(() => parseRecipe("# Just some markdown", "x")).toThrow(
      RecipeParseError,
    );
  });

  it("broken yaml throws", () => {
    expect(() => parseRecipe("---\ntitle: [unclosed\n---\nBody", "x")).toThrow(
      RecipeParseError,
    );
  });

  it("unreadable quantity becomes null with warning", () => {
    const result = parseRecipe(
      `---
title: X
slug: x
servings: 2
ingredients:
  - name: flour
    quantity: a handful
---
`,
      "x",
    );

    expect(result.data.ingredients[0].quantity).toBeNull();
    expect(result.warnings.join(" ")).toContain("flour");
  });
});
