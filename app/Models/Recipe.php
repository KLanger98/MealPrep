<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Recipe extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'tags' => 'array',
            'ingredients' => 'array',
            'meta' => 'array',
            'missing_at' => 'datetime',
        ];
    }

    public function mealAssignments(): HasMany
    {
        return $this->hasMany(MealAssignment::class);
    }

    /**
     * Recipes whose source .md file still exists.
     */
    public function scopeAvailable(Builder $query): Builder
    {
        return $query->whereNull('missing_at');
    }

    /**
     * Extensions tried for the sibling-file convention (beef-chilli.md next
     * to beef-chilli.jpg), in priority order.
     */
    private const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    /**
     * Absolute path to this recipe's image, or null. Resolved live from the
     * filesystem so dropping an image in next to the .md works immediately.
     *
     * Checks the frontmatter `image:` path first (relative to the .md file),
     * then falls back to a sibling file with the same basename. Anything
     * resolving outside the recipes directory is rejected.
     */
    public function imagePath(): ?string
    {
        $dir = dirname($this->file_path);

        $candidates = [];

        if ($this->image !== null) {
            $candidates[] = $dir.DIRECTORY_SEPARATOR.$this->image;
        }

        $basename = pathinfo($this->file_path, PATHINFO_FILENAME);

        foreach (self::IMAGE_EXTENSIONS as $extension) {
            $candidates[] = $dir.DIRECTORY_SEPARATOR.$basename.'.'.$extension;
        }

        $root = realpath(config('recipes.path'));

        foreach ($candidates as $candidate) {
            $real = realpath($candidate);

            if ($real !== false && is_file($real) && $root !== false && str_starts_with($real, $root.DIRECTORY_SEPARATOR)) {
                return $real;
            }
        }

        return null;
    }

    /**
     * Versioned URL for the image route, or null if there's no image.
     */
    public function imageUrl(): ?string
    {
        $path = $this->imagePath();

        if ($path === null) {
            return null;
        }

        return route('recipes.image', [$this->slug, 'v' => filemtime($path)]);
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }

        $like = '%'.str_replace(['%', '_'], ['\%', '\_'], mb_strtolower($term)).'%';

        return $query->where(function (Builder $q) use ($like) {
            $q->whereRaw('lower(title) like ?', [$like])
                ->orWhereRaw('lower(ingredients) like ?', [$like]);
        });
    }
}
