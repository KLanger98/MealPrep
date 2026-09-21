import { describe, expect, it } from "vitest";
import type { Recipe } from "../../database/schema";
import { parseRecipe } from "../../app/lib/recipe-parser";
import { recipeToMarkdown } from "../../app/lib/recipe-serializer";

const SOURCE = `---
title: "Chilli: the good one"
slug: beef-chilli
type: dinner
servings: 4
protein: beef
cost: medium
source: https://example.com/chilli
rating: 8.5
prep_minutes: 15
cook_minutes: 60
tags: [freezes-well, spicy]
spice_level: hot
ingredients:
  - name: beef mince
    quantity: 500
    unit: g
    category: meat
  - name: salt
    note: to taste
    category: pantry
---

## Method

1. Brown the mince.
`;

describe("recipeToMarkdown", () => {
  it("round-trips through parseRecipe", () => {
    const { data } = parseRecipe(SOURCE);
    const { ingredients, ...columns } = data;

    const markdown = recipeToMarkdown(columns as unknown as Recipe, ingredients);
    const again = parseRecipe(markdown);

    expect(again.warnings).toEqual([]);
    expect(again.data).toEqual(data);
  });
});
