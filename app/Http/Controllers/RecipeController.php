<?php

namespace App\Http\Controllers;

use App\Exceptions\RecipeParseException;
use App\Models\Recipe;
use App\Services\RecipeFileParser;
use App\Services\RecipeSyncer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class RecipeController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['type', 'protein', 'cost', 'tag', 'q']);

        $recipes = Recipe::query()
            ->available()
            ->when($filters['type'] ?? null, fn ($q, $type) => $q->where('type', $type))
            ->when($filters['protein'] ?? null, fn ($q, $protein) => $q->where('protein', $protein))
            ->when($filters['cost'] ?? null, fn ($q, $cost) => $q->where('cost', $cost))
            ->when($filters['tag'] ?? null, fn ($q, $tag) => $q->whereJsonContains('tags', $tag))
            ->search($filters['q'] ?? null)
            ->orderBy('title')
            ->get()
            ->map(fn (Recipe $recipe) => [
                'slug' => $recipe->slug,
                'title' => $recipe->title,
                'type' => $recipe->type,
                'protein' => $recipe->protein,
                'cost' => $recipe->cost,
                'servings' => $recipe->servings,
                'tags' => $recipe->tags,
                'total_minutes' => ($recipe->prep_minutes ?? 0) + ($recipe->cook_minutes ?? 0) ?: null,
                'image_url' => $recipe->imageUrl(),
            ]);

        $available = Recipe::available();

        return Inertia::render('Recipes/Index', [
            'recipes' => $recipes,
            'filters' => $filters,
            'filterOptions' => [
                'types' => $available->clone()->distinct()->orderBy('type')->pluck('type'),
                'proteins' => $available->clone()->whereNotNull('protein')->distinct()->orderBy('protein')->pluck('protein'),
                'costs' => $available->clone()->whereNotNull('cost')->distinct()->pluck('cost'),
                'tags' => $available->clone()->pluck('tags')->flatten()->unique()->sort()->values(),
            ],
        ]);
    }

    public function show(Recipe $recipe): Response
    {
        return Inertia::render('Recipes/Show', [
            'recipe' => [
                'slug' => $recipe->slug,
                'title' => $recipe->title,
                'type' => $recipe->type,
                'protein' => $recipe->protein,
                'cost' => $recipe->cost,
                'prep_minutes' => $recipe->prep_minutes,
                'cook_minutes' => $recipe->cook_minutes,
                'servings' => $recipe->servings,
                'tags' => $recipe->tags,
                'ingredients' => $recipe->ingredients,
                'body_html' => Str::markdown($recipe->body_markdown ?? '', [
                    'html_input' => 'strip',
                    'allow_unsafe_links' => false,
                ]),
                'missing' => $recipe->missing_at !== null,
                'file_path' => $recipe->file_path,
                'image_url' => $recipe->imageUrl(),
            ],
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Recipes/Create', [
            'template' => <<<'MD'
            ---
            title:
            slug:
            type: dinner
            servings: 4
            protein:
            cost: medium
            prep_minutes:
            cook_minutes:
            tags: []
            ingredients:
              - name:
                quantity:
                unit: g
                category:
            ---

            ## Method

            1.

            ## Notes


            MD,
        ]);
    }

    public function store(Request $request, RecipeFileParser $parser, RecipeSyncer $syncer): RedirectResponse
    {
        $content = $this->validatedContent($request);
        $parsed = $this->parseOrFail($parser, $content);

        $slug = $parsed['data']['slug'];
        $path = config('recipes.path').DIRECTORY_SEPARATOR.$slug.'.md';

        if (Recipe::where('slug', $slug)->exists() || file_exists($path)) {
            throw ValidationException::withMessages([
                'content' => "A recipe with the slug \"{$slug}\" already exists.",
            ]);
        }

        if (! is_dir(config('recipes.path'))) {
            mkdir(config('recipes.path'), 0755, true);
        }

        file_put_contents($path, $content);
        $syncer->sync();

        return redirect()->route('recipes.show', $slug);
    }

    public function edit(Recipe $recipe): Response|RedirectResponse
    {
        $contents = @file_get_contents($recipe->file_path);

        if ($contents === false) {
            return redirect()
                ->route('recipes.show', $recipe->slug)
                ->withErrors(['content' => 'The recipe file is missing — restore it before editing.']);
        }

        return Inertia::render('Recipes/Edit', [
            'recipe' => [
                'slug' => $recipe->slug,
                'title' => $recipe->title,
                'file_path' => $recipe->file_path,
            ],
            'content' => $contents,
        ]);
    }

    public function update(Request $request, Recipe $recipe, RecipeFileParser $parser, RecipeSyncer $syncer): RedirectResponse
    {
        $content = $this->validatedContent($request);
        $parsed = $this->parseOrFail($parser, $content, $recipe->slug);

        // The slug is the recipe's identity — calendar assignments point at it.
        if ($parsed['data']['slug'] !== $recipe->slug) {
            throw ValidationException::withMessages([
                'content' => "The slug can't be changed here (calendar assignments reference \"{$recipe->slug}\"). Keep slug: {$recipe->slug}",
            ]);
        }

        file_put_contents($recipe->file_path, $content);
        $syncer->sync();

        return redirect()->route('recipes.show', $recipe->slug);
    }

    public function destroy(Recipe $recipe): RedirectResponse
    {
        if (is_file($recipe->file_path)) {
            unlink($recipe->file_path);
        }

        // Explicit delete removes the index row too (assignments cascade),
        // unlike a file disappearing on its own, which only flags missing_at.
        $recipe->delete();

        return redirect()->route('recipes.index');
    }

    private function validatedContent(Request $request): string
    {
        return $request->validate([
            'content' => ['required', 'string', 'max:65535'],
        ])['content'];
    }

    /**
     * @return array{data: array<string, mixed>, warnings: string[]}
     */
    private function parseOrFail(RecipeFileParser $parser, string $content, string $fallbackSlug = ''): array
    {
        try {
            return $parser->parseString($content, $fallbackSlug);
        } catch (RecipeParseException $e) {
            throw ValidationException::withMessages(['content' => $e->getMessage()]);
        }
    }

    public function image(Recipe $recipe): BinaryFileResponse
    {
        $path = $recipe->imagePath();

        abort_if($path === null, 404);

        return response()->file($path, [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }
}
