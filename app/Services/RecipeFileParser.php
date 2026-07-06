<?php

namespace App\Services;

use App\Exceptions\RecipeParseException;
use App\Support\QuantityParser;
use Illuminate\Support\Str;
use Spatie\YamlFrontMatter\YamlFrontMatter;
use Throwable;

class RecipeFileParser
{
    /**
     * Frontmatter keys that map to their own recipe columns. Anything else
     * is preserved in the meta column so unknown/experimental keys survive.
     */
    private const KNOWN_KEYS = [
        'title', 'slug', 'type', 'servings', 'protein', 'cost',
        'prep_minutes', 'cook_minutes', 'tags', 'ingredients', 'image',
    ];

    /**
     * Parse a recipe .md file into recipe attributes plus non-fatal warnings.
     *
     * @return array{data: array<string, mixed>, warnings: string[]}
     *
     * @throws RecipeParseException on unreadable files, broken YAML, or a missing title
     */
    public function parse(string $path): array
    {
        $contents = @file_get_contents($path);

        if ($contents === false) {
            throw new RecipeParseException("Could not read file: {$path}");
        }

        return $this->parseString($contents, pathinfo($path, PATHINFO_FILENAME));
    }

    /**
     * Parse raw recipe markdown (e.g. from the in-app editor) without
     * touching the filesystem.
     *
     * @return array{data: array<string, mixed>, warnings: string[]}
     *
     * @throws RecipeParseException
     */
    public function parseString(string $contents, string $fallbackSlugSource = ''): array
    {
        try {
            $document = YamlFrontMatter::parse($contents);
            $matter = $document->matter();
        } catch (Throwable $e) {
            throw new RecipeParseException('Invalid YAML frontmatter: '.$e->getMessage());
        }

        if (! is_array($matter) || $matter === []) {
            throw new RecipeParseException('No YAML frontmatter found (file must start with a --- block).');
        }

        $warnings = [];

        $title = trim((string) ($matter['title'] ?? ''));

        if ($title === '') {
            throw new RecipeParseException('Missing required "title" in frontmatter.');
        }

        $slug = Str::slug((string) ($matter['slug'] ?? ''));

        if ($slug === '') {
            $slug = Str::slug($fallbackSlugSource) ?: Str::slug($title);
            $warnings[] = "No slug in frontmatter; using derived slug \"{$slug}\".";
        }

        $servings = filter_var($matter['servings'] ?? null, FILTER_VALIDATE_INT);

        if ($servings === false || $servings === null || $servings < 1) {
            $warnings[] = 'Missing or invalid "servings"; defaulting to 1 (scaling will treat the whole recipe as one serving).';
            $servings = 1;
        }

        $ingredients = $this->parseIngredients($matter['ingredients'] ?? null, $warnings);

        if ($ingredients === []) {
            $warnings[] = 'No ingredients listed; shopping lists will skip this recipe.';
        }

        $tags = $matter['tags'] ?? [];
        $tags = is_array($tags) ? array_values(array_filter(array_map(fn ($t) => trim((string) $t), $tags))) : [];

        $meta = array_diff_key($matter, array_flip(self::KNOWN_KEYS));

        return [
            'data' => [
                'slug' => $slug,
                'title' => $title,
                'type' => mb_strtolower(trim((string) ($matter['type'] ?? ''))) ?: 'other',
                'protein' => $this->stringOrNull($matter['protein'] ?? null),
                'cost' => $this->stringOrNull($matter['cost'] ?? null),
                'prep_minutes' => $this->minutesOrNull($matter['prep_minutes'] ?? null),
                'cook_minutes' => $this->minutesOrNull($matter['cook_minutes'] ?? null),
                'servings' => $servings,
                'tags' => $tags,
                'ingredients' => $ingredients,
                'image' => $this->stringOrNull($matter['image'] ?? null, lowercase: false),
                'body_markdown' => trim($document->body()),
                'meta' => $meta === [] ? null : $meta,
            ],
            'warnings' => $warnings,
        ];
    }

    /**
     * @return array<int, array{name: string, quantity: ?float, unit: ?string, note: ?string, category: ?string}>
     */
    private function parseIngredients(mixed $raw, array &$warnings): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $ingredients = [];

        foreach ($raw as $i => $item) {
            // Allow a bare string ("salt") as shorthand for a nameless-quantity item.
            if (is_string($item)) {
                $item = ['name' => $item];
            }

            if (! is_array($item)) {
                $warnings[] = 'Ingredient #'.($i + 1).' is not a map or string; skipped.';
                continue;
            }

            $name = trim((string) ($item['name'] ?? ''));

            if ($name === '') {
                $warnings[] = 'Ingredient #'.($i + 1).' has no "name"; skipped.';
                continue;
            }

            $quantity = QuantityParser::parse($item['quantity'] ?? null);

            if (($item['quantity'] ?? null) !== null && $quantity === null) {
                $warnings[] = "Ingredient \"{$name}\" has an unreadable quantity \"{$item['quantity']}\"; treated as unquantified.";
            }

            $ingredients[] = [
                'name' => $name,
                'quantity' => $quantity,
                'unit' => $this->stringOrNull($item['unit'] ?? null),
                'note' => $this->stringOrNull($item['note'] ?? null, lowercase: false),
                'category' => $this->stringOrNull($item['category'] ?? null),
            ];
        }

        return $ingredients;
    }

    private function stringOrNull(mixed $value, bool $lowercase = true): ?string
    {
        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        return $lowercase ? mb_strtolower($value) : $value;
    }

    private function minutesOrNull(mixed $value): ?int
    {
        $minutes = filter_var($value, FILTER_VALIDATE_INT);

        return ($minutes === false || $minutes < 0) ? null : $minutes;
    }
}
