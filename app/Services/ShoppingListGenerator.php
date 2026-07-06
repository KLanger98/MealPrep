<?php

namespace App\Services;

use App\Models\MealAssignment;
use App\Models\ShoppingList;
use App\Support\UnitNormalizer;
use Illuminate\Support\Collection;

class ShoppingListGenerator
{
    private const CATEGORY_ORDER = [
        'produce', 'meat', 'seafood', 'dairy', 'bakery', 'frozen', 'pantry', 'other',
    ];

    /**
     * Build (or rebuild) the items for a shopping list from every batch
     * whose days overlap the list's date range.
     *
     * A batch (one cook of a recipe, possibly eaten across several days) is
     * counted exactly once, even if only some of its days fall in the range —
     * you still cook the whole thing.
     */
    public function generate(ShoppingList $list): ShoppingList
    {
        $batches = MealAssignment::with('recipe')
            ->betweenDates($list->start_date->toDateString(), $list->end_date->toDateString())
            ->get()
            ->unique('batch_id');

        $merged = $this->mergeIngredients($batches);

        // Preserve check state across regenerations by matching name + unit.
        $previouslyChecked = $list->items()
            ->whereNotNull('checked_at')
            ->get()
            ->keyBy(fn ($item) => $item->name.'|'.$item->unit);

        $list->items()->delete();

        $sortOrder = 0;

        foreach ($merged as $item) {
            $list->items()->create([
                ...$item,
                'checked_at' => $previouslyChecked[$item['name'].'|'.$item['unit']]->checked_at ?? null,
                'sort_order' => $sortOrder++,
            ]);
        }

        return $list->load('items');
    }

    /**
     * Explode every batch's ingredients (scaled), then merge lines that share
     * a normalized name + canonical unit. Unquantified items merge into a
     * single unquantified line per name.
     *
     * @param Collection<int, MealAssignment> $batches
     * @return array<int, array{name: string, quantity: ?float, unit: ?string, category: string, sources: array}>
     */
    private function mergeIngredients(Collection $batches): array
    {
        $lines = [];

        foreach ($batches as $assignment) {
            $recipe = $assignment->recipe;

            foreach ($recipe->ingredients as $ingredient) {
                $name = mb_strtolower(trim($ingredient['name']));
                $rawQuantity = $ingredient['quantity'] ?? null;

                if ($rawQuantity === null) {
                    $quantity = null;
                    $unit = null;
                } else {
                    [$quantity, $unit] = UnitNormalizer::canonicalize(
                        $rawQuantity * $assignment->scale_factor,
                        $ingredient['unit'] ?? null,
                    );
                }

                $key = $name.'|'.($quantity === null ? '' : $unit);

                $lines[$key] ??= [
                    'name' => $name,
                    'quantity' => null,
                    'unit' => $unit,
                    'category' => $ingredient['category'] ?? null,
                    'sources' => [],
                ];

                if ($quantity !== null) {
                    $lines[$key]['quantity'] = ($lines[$key]['quantity'] ?? 0) + $quantity;
                }

                $lines[$key]['category'] ??= $ingredient['category'] ?? null;
                $lines[$key]['sources'][] = [
                    'recipe' => $recipe->title,
                    'quantity' => $rawQuantity === null ? null : round($rawQuantity * $assignment->scale_factor, 2),
                    'unit' => $ingredient['unit'] ?? null,
                    'scale' => $assignment->scale_factor,
                ];
            }
        }

        $lines = array_map(function (array $line) {
            if ($line['quantity'] !== null) {
                [$line['quantity'], $line['unit']] = UnitNormalizer::humanize($line['quantity'], $line['unit']);
                $line['quantity'] = round($line['quantity'], 2);
            }
            $line['category'] ??= 'other';

            return $line;
        }, array_values($lines));

        usort($lines, function (array $a, array $b) {
            $catA = array_search($a['category'], self::CATEGORY_ORDER);
            $catB = array_search($b['category'], self::CATEGORY_ORDER);

            return [$catA === false ? PHP_INT_MAX : $catA, $a['name']]
                <=> [$catB === false ? PHP_INT_MAX : $catB, $b['name']];
        });

        return $lines;
    }
}
