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
