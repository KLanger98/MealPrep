<?php

namespace App\Services;

use App\Exceptions\RecipeParseException;
use App\Models\Recipe;
use App\Models\RecipeImportError;
use Symfony\Component\Finder\Finder;

class RecipeSyncer
{
    public function __construct(
        private RecipeFileParser $parser,
    ) {
    }

    /**
     * Scan the recipes directory and reconcile the database index with it.
     *
     * @return array{created: string[], updated: string[], unchanged: string[], missing: string[], errors: array<string, string>}
     */
    public function sync(bool $force = false): array
    {
        $result = [
            'created' => [],
            'updated' => [],
            'unchanged' => [],
            'missing' => [],
            'errors' => [],
        ];

        $path = config('recipes.path');

        if (! is_dir($path)) {
            return $result;
        }

        RecipeImportError::query()->delete();

        $existingByPath = Recipe::all()->keyBy('file_path');
        $seenSlugs = [];

        $finder = Finder::create()
            ->files()
            ->in($path)
            ->name('*.md')
            ->notName(config('recipes.ignore', []))
            ->sortByName();

        foreach ($finder as $file) {
            $filePath = $file->getRealPath();
            $mtime = $file->getMTime();
            $hash = md5_file($filePath);

            $byPath = $existingByPath->get($filePath);

            // Unchanged file: trust the index, skip the parse.
            if (! $force && $byPath && $byPath->file_mtime === $mtime && $byPath->file_hash === $hash) {
                if (isset($seenSlugs[$byPath->slug])) {
                    $this->recordError($filePath, "Duplicate slug \"{$byPath->slug}\" (already used by {$seenSlugs[$byPath->slug]}); file skipped.");
                    $result['errors'][$filePath] = 'duplicate slug';
                    continue;
                }

                $seenSlugs[$byPath->slug] = $filePath;

                // A previously-deleted file that reappeared with identical content.
                if ($byPath->missing_at !== null) {
                    $byPath->update(['missing_at' => null]);
                }

                $result['unchanged'][] = $byPath->slug;
                continue;
            }

            try {
                $parsed = $this->parser->parse($filePath);
            } catch (RecipeParseException $e) {
                $this->recordError($filePath, $e->getMessage());
                $result['errors'][$filePath] = $e->getMessage();
                continue;
            }

            $data = $parsed['data'];
            $slug = $data['slug'];

            if (isset($seenSlugs[$slug])) {
                $this->recordError($filePath, "Duplicate slug \"{$slug}\" (already used by {$seenSlugs[$slug]}); file skipped.");
                $result['errors'][$filePath] = 'duplicate slug';
                continue;
            }

            $seenSlugs[$slug] = $filePath;

            foreach ($parsed['warnings'] as $warning) {
                $this->recordError($filePath, $warning, level: 'warning');
            }

            $recipe = Recipe::firstOrNew(['slug' => $slug]);
            $wasNew = ! $recipe->exists;

            $recipe->fill([
                ...$data,
                'file_path' => $filePath,
                'file_mtime' => $mtime,
                'file_hash' => $hash,
                'missing_at' => null,
            ])->save();

            $result[$wasNew ? 'created' : 'updated'][] = $slug;
        }

        // Anything in the index whose file no longer exists gets flagged, not deleted,
        // so calendar assignments pointing at it keep rendering.
        $missing = Recipe::query()
            ->whereNotIn('slug', array_keys($seenSlugs) ?: [''])
            ->whereNull('missing_at')
            ->get();

        foreach ($missing as $recipe) {
            $recipe->update(['missing_at' => now()]);
            $result['missing'][] = $recipe->slug;
        }

        return $result;
    }

    private function recordError(string $filePath, string $message, string $level = 'error'): void
    {
        RecipeImportError::create([
            'file_path' => $filePath,
            'level' => $level,
            'message' => $message,
        ]);
    }
}
