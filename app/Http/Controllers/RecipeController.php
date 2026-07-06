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
                'rating' => $recipe->rating,
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
                'source' => $recipe->source,
                'rating' => $recipe->rating,
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
            source:
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

    /**
     * Set or clear the rating by rewriting just the `rating:` line in the
     * file's frontmatter — the file stays the source of truth.
     */
    public function rate(Request $request, Recipe $recipe, RecipeSyncer $syncer): RedirectResponse
    {
        $validated = $request->validate([
            'rating' => ['nullable', 'numeric', 'min:0', 'max:10'],
        ]);

        $rating = isset($validated['rating']) ? round((float) $validated['rating'], 1) : null;

        $contents = @file_get_contents($recipe->file_path);

        if ($contents === false) {
            throw ValidationException::withMessages([
                'rating' => 'The recipe file is missing — restore it before rating.',
            ]);
        }

        if (! preg_match('/\A(---\R)(.*?)(\R---)/s', $contents, $m, PREG_OFFSET_CAPTURE)) {
            throw ValidationException::withMessages([
                'rating' => 'Could not find the frontmatter block in the recipe file.',
            ]);
        }

        $front = $m[2][0];

        $lines = array_values(array_filter(
            preg_split('/\R/', $front),
            fn (string $line) => ! str_starts_with($line, 'rating:'),
        ));

        if ($rating !== null) {
            $lines[] = 'rating: '.(fmod($rating, 1) === 0.0 ? (int) $rating : $rating);
        }

        $contents = substr_replace($contents, implode("\n", $lines), $m[2][1], strlen($front));
        file_put_contents($recipe->file_path, $contents);
        $syncer->sync();

        return back();
    }

    /**
     * Upload (or replace) the recipe photo. The file is stored next to the
     * .md with the same basename — the sibling convention — so the recipes
     * folder stays self-contained and portable.
     */
    public function storeImage(Request $request, Recipe $recipe, RecipeSyncer $syncer): RedirectResponse
    {
        $request->validate([
            'photo' => ['required', 'image', 'mimes:jpeg,jpg,png,webp,gif', 'max:15360'],
        ]);

        $photo = $request->file('photo');

        foreach ($recipe->siblingImagePaths() as $existing) {
            unlink($existing);
        }

        $extension = strtolower($photo->getClientOriginalExtension()) ?: $photo->extension();
        $basename = pathinfo($recipe->file_path, PATHINFO_FILENAME);
        $directory = dirname($recipe->file_path);

        $photo->move($directory, $basename.'.'.$extension);
        $this->normalizePhoto($directory.DIRECTORY_SEPARATOR.$basename.'.'.$extension);

        // A frontmatter image: path would shadow the upload — drop it.
        $this->removeFrontmatterKey($recipe, 'image');
        $syncer->sync();

        return back();
    }

    public function destroyImage(Recipe $recipe, RecipeSyncer $syncer): RedirectResponse
    {
        foreach ($recipe->siblingImagePaths() as $existing) {
            unlink($existing);
        }

        $this->removeFrontmatterKey($recipe, 'image');
        $syncer->sync();

        return back();
    }

    /**
     * Phone photos are huge and often carry an EXIF rotation: bake the
     * orientation in and cap the longest edge at 1600px. Non-JPEG/PNG files
     * are left untouched.
     */
    private function normalizePhoto(string $path): void
    {
        $info = @getimagesize($path);

        if ($info === false || ! in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG], true)) {
            return;
        }

        $image = $info[2] === IMAGETYPE_JPEG ? @imagecreatefromjpeg($path) : @imagecreatefrompng($path);

        if ($image === false) {
            return;
        }

        if ($info[2] === IMAGETYPE_JPEG && function_exists('exif_read_data')) {
            $orientation = @exif_read_data($path)['Orientation'] ?? 1;
            $image = match ($orientation) {
                3 => imagerotate($image, 180, 0),
                6 => imagerotate($image, -90, 0),
                8 => imagerotate($image, 90, 0),
                default => $image,
            };
        }

        $max = 1600;
        $width = imagesx($image);
        $height = imagesy($image);

        if (max($width, $height) > $max) {
            $scale = $max / max($width, $height);
            $image = imagescale($image, (int) round($width * $scale), (int) round($height * $scale));
        }

        if ($info[2] === IMAGETYPE_JPEG) {
            imagejpeg($image, $path, 82);
        } else {
            imagepng($image, $path);
        }
    }

    /**
     * Remove a top-level key's line from the file's frontmatter block.
     */
    private function removeFrontmatterKey(Recipe $recipe, string $key): void
    {
        $contents = @file_get_contents($recipe->file_path);

        if ($contents === false || ! preg_match('/\A(---\R)(.*?)(\R---)/s', $contents, $m, PREG_OFFSET_CAPTURE)) {
            return;
        }

        $front = $m[2][0];

        $lines = array_values(array_filter(
            preg_split('/\R/', $front),
            fn (string $line) => ! str_starts_with($line, $key.':'),
        ));

        $newFront = implode("\n", $lines);

        if ($newFront !== $front) {
            file_put_contents($recipe->file_path, substr_replace($contents, $newFront, $m[2][1], strlen($front)));
        }
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
