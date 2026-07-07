---
name: recipe-clipper
description: Clip a recipe into the meal-prep app from a URL, screenshot, or photo. Use whenever the user shares a recipe link, a screenshot of a recipe, or a photo of a cookbook page and wants it saved to their meal-prep app.
---

# Recipe clipper

Save a recipe into the user's meal-prep app (https://meal-prep.karl-w-langer.workers.dev) using the **meal-prep** connector's MCP tools.

## Workflow

1. **Get the source content.**
   - URL → fetch the page and extract the recipe (title, servings, times, ingredients with quantities, method steps). Ignore ads, life stories, and comment sections.
   - Screenshot or photo → transcribe the recipe exactly from the image. If parts are cut off or illegible, ask the user rather than inventing quantities.
   - Record the source: the URL, or the literal string `photo` for images.

2. **Call `get_recipe_context` first — always.** It returns the recipe file schema (SCHEMA.md) and the collection's existing vocabulary. Then:
   - **Reuse existing ingredient names verbatim.** Shopping lists merge by exact name — if the vocabulary has `spring onions`, never write `scallions`; if it has `chicken thighs`, don't write `chicken thigh fillets`.
   - Reuse existing tags and protein values where they fit.
   - Check `existing_slugs` so your slug doesn't collide.

3. **Compose the .md file** following the returned schema exactly. Key rules:
   - `title` and `ingredients` are required; always include `slug` (stable, lowercase-hyphenated), `type`, and `servings`.
   - Prefer grams over cups/volume for anything weighable; use short-form units (`g`, `ml`, `tbsp`). Convert imperial to metric.
   - "To taste" items: omit `quantity` entirely and set `note: to taste`.
   - Give every ingredient a `category` (produce, meat, seafood, dairy, pantry, frozen, bakery, other).
   - `source:` = the URL or `photo`.
   - Body: `## Method` with numbered steps, `## Notes` for storage/reheating tips if the source has them.
   - Do not include `rating` or `image`.

4. **Call `create_recipe`** with the complete file as `content`.
   - On a validation error, read the message, fix the file, and retry (up to 3 attempts).
   - On a duplicate-slug error, check with `get_recipe` whether it's genuinely the same recipe — if so tell the user it already exists; if it's a different recipe, pick a distinguishing slug (e.g. `beef-chilli-slow-cooker`).

5. **Report back** with the recipe title, the link `https://meal-prep.karl-w-langer.workers.dev/recipes/<slug>`, and any warnings the tool returned. Keep it short.

## Notes

- Scale nothing — save the recipe at the servings the source states; the app handles scaling.
- If the source is ambiguous (e.g. "1 can of tomatoes" with no size), keep the source's wording in `note` rather than guessing grams.
