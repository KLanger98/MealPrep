# Recipe File Schema

Every recipe is a single Markdown file in this folder (subfolders are fine).
The file starts with a YAML frontmatter block holding structured data, followed
by the method written in plain Markdown.

**If you are an AI creating a recipe file: follow this document exactly and
save the file as `recipes/<slug>.md`.**

## Full example

```markdown
---
title: Chicken Burrito Bowls
slug: chicken-burrito-bowls
type: dinner
servings: 4
protein: chicken
cost: medium
prep_minutes: 20
cook_minutes: 35
tags: [meal-prep-friendly, freezes-well]
ingredients:
  - name: chicken thighs
    quantity: 800
    unit: g
    note: boneless, skinless
    category: meat
  - name: long-grain rice
    quantity: 2
    unit: cup
    category: pantry
  - name: limes
    quantity: 2
    unit: whole
    note: juiced
    category: produce
  - name: salt
    note: to taste
    category: pantry
---

## Method

1. Season the chicken thighs and pan-fry until cooked through.
2. Cook the rice. Combine and portion into containers.

## Notes

Keeps 4 days refrigerated.
```

## Frontmatter fields

| Field | Required | Notes |
|---|---|---|
| `title` | **yes** | Display name of the recipe. |
| `slug` | recommended | Stable lowercase-hyphen ID, e.g. `beef-chilli`. Never change it once used — the calendar references it. Falls back to the filename if omitted. |
| `type` | recommended | One of: `breakfast`, `lunch`, `dinner`, `snack`, `component` (a component is a building block like a sauce or spice mix). Defaults to `other`. |
| `servings` | recommended | Integer. How many servings the ingredient quantities make. Used for scaling. Defaults to 1 with a warning. |
| `protein` | optional | Main protein, freeform but be consistent: `chicken`, `beef`, `pork`, `lamb`, `fish`, `seafood`, `eggs`, `tofu`, `legumes`, `vegetarian`. |
| `cost` | optional | `low`, `medium`, or `high`. |
| `source` | optional | Where the recipe came from — a URL (shown as a link) or freeform text like `Mum's recipe` or `RecipeTin Eats cookbook p. 142`. |
| `rating` | optional | Your score out of 10 (decimals ok, e.g. `7.5`). Usually set from the app after cooking it — you don't need to include it when creating a recipe. |
| `prep_minutes` | optional | Integer, hands-on time. |
| `cook_minutes` | optional | Integer, cooking time. |
| `tags` | optional | YAML list of freeform tags, e.g. `[meal-prep-friendly, freezes-well, spicy]`. |
| `image` | optional | Path to a photo, relative to this recipe file, e.g. `images/beef-chilli.jpg`. Usually unnecessary — see below. |
| `ingredients` | **yes** | List of ingredient maps — see below. |

Unknown extra fields are kept but ignored, so a typo like `preptime` won't
break anything — it just won't do anything.

## Ingredient fields

| Field | Required | Notes |
|---|---|---|
| `name` | **yes** | Lowercase, singular-ish, and **consistent across recipes** — shopping lists merge by exact name, so always call it `spring onions`, not sometimes `scallions`. |
| `quantity` | optional | A number. Decimals (`0.5`) and fractions (`1/2`, `1 1/2`) are accepted. Omit entirely for "to taste" items — they then appear on shopping lists once, without a number, and never scale. |
| `unit` | optional | See allowed units below. Omit for countable things only if using `whole`. |
| `note` | optional | Prep detail shown next to the ingredient, e.g. `finely diced`, `to taste`. |
| `category` | optional | Shopping-list aisle grouping: `produce`, `meat`, `seafood`, `dairy`, `pantry`, `frozen`, `bakery`, `other`. |

## Units

Use these (aliases like `grams`, `tablespoon` are auto-normalized, but the
short form is preferred):

- Weight: `g`, `kg`, `oz`, `lb`
- Volume: `ml`, `l`, `tsp`, `tbsp`, `cup`
- Count/other: `whole`, `clove`, `bunch`, `can`, `slice`, `head`, `stalk`, `sprig`, `pinch`, `packet`

Prefer weight (`g`) over volume for anything you'd weigh. `g`/`kg` and
`ml`/`l` merge automatically on shopping lists; other unit pairs (e.g. `cup`
vs `g` of rice) will appear as separate lines, so keep the same ingredient in
the same unit across recipes where you can.

## Images

The easiest way to give a recipe a photo needs no frontmatter at all: save an
image with the **same basename as the recipe file**, in the same folder —
`beef-chilli.md` + `beef-chilli.jpg`. Supported: `.jpg`, `.jpeg`, `.png`,
`.webp`, `.gif` (checked in that order).

Use the `image:` frontmatter field only when the file can't sit alongside
with a matching name (e.g. a shared `images/` subfolder). The path is
relative to the recipe file and must stay inside the recipes folder.

## Markdown body

Everything after the closing `---` is free-form Markdown. Suggested sections:

- `## Method` — numbered steps.
- `## Notes` — storage life, reheating, substitutions.
