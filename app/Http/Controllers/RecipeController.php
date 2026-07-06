<?php

namespace App\Http\Controllers;

use App\Models\Recipe;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
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

    public function image(Recipe $recipe): BinaryFileResponse
    {
        $path = $recipe->imagePath();

        abort_if($path === null, 404);

        return response()->file($path, [
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]);
    }
}
