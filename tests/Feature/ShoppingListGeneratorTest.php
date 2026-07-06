<?php

namespace Tests\Feature;

use App\Models\MealAssignment;
use App\Models\Recipe;
use App\Models\ShoppingList;
use App\Services\ShoppingListGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ShoppingListGeneratorTest extends TestCase
{
    use RefreshDatabase;

    private function makeRecipe(string $slug, array $ingredients, int $servings = 4): Recipe
    {
        return Recipe::create([
            'slug' => $slug,
            'title' => Str::headline($slug),
            'type' => 'dinner',
            'servings' => $servings,
            'tags' => [],
            'ingredients' => $ingredients,
            'file_path' => "/fake/{$slug}.md",
            'file_mtime' => 1,
            'file_hash' => md5($slug),
        ]);
    }

    private function assign(Recipe $recipe, string $start, string $end, float $scale = 1, string $slot = 'dinner'): string
    {
        $batchId = (string) Str::uuid();
        $date = \Illuminate\Support\Carbon::parse($start);
        $endDate = \Illuminate\Support\Carbon::parse($end);

        while ($date->lte($endDate)) {
            MealAssignment::create([
                'recipe_id' => $recipe->id,
                'date' => $date->toDateString(),
                'slot' => $slot,
                'batch_id' => $batchId,
                'scale_factor' => $scale,
            ]);
            $date->addDay();
        }

        return $batchId;
    }

    private function generate(string $start, string $end): ShoppingList
    {
        $list = ShoppingList::create(['start_date' => $start, 'end_date' => $end]);

        return app(ShoppingListGenerator::class)->generate($list);
    }

    public function test_same_ingredient_same_unit_is_summed(): void
    {
        $a = $this->makeRecipe('a', [['name' => 'long-grain rice', 'quantity' => 2, 'unit' => 'cup', 'note' => null, 'category' => 'pantry']]);
        $b = $this->makeRecipe('b', [['name' => 'long-grain rice', 'quantity' => 1, 'unit' => 'cup', 'note' => null, 'category' => 'pantry']]);
        $this->assign($a, '2026-07-06', '2026-07-06');
        $this->assign($b, '2026-07-07', '2026-07-07');

        $list = $this->generate('2026-07-06', '2026-07-12');

        $rice = $list->items->firstWhere('name', 'long-grain rice');
        $this->assertSame(3.0, $rice->quantity);
        $this->assertSame('cup', $rice->unit);
        $this->assertCount(2, $rice->sources);
    }

    public function test_metric_pairs_merge_and_humanize(): void
    {
        $a = $this->makeRecipe('a', [['name' => 'beef mince', 'quantity' => 1, 'unit' => 'kg', 'note' => null, 'category' => 'meat']]);
        $b = $this->makeRecipe('b', [['name' => 'beef mince', 'quantity' => 800, 'unit' => 'g', 'note' => null, 'category' => 'meat']]);
        $this->assign($a, '2026-07-06', '2026-07-06');
        $this->assign($b, '2026-07-07', '2026-07-07');

        $list = $this->generate('2026-07-06', '2026-07-12');

        $beef = $list->items->firstWhere('name', 'beef mince');
        $this->assertSame(1.8, $beef->quantity);
        $this->assertSame('kg', $beef->unit);
    }

    public function test_incompatible_units_stay_on_separate_lines(): void
    {
        $a = $this->makeRecipe('a', [['name' => 'olive oil', 'quantity' => 2, 'unit' => 'tbsp', 'note' => null, 'category' => 'pantry']]);
        $b = $this->makeRecipe('b', [['name' => 'olive oil', 'quantity' => 100, 'unit' => 'ml', 'note' => null, 'category' => 'pantry']]);
        $this->assign($a, '2026-07-06', '2026-07-06');
        $this->assign($b, '2026-07-07', '2026-07-07');

        $list = $this->generate('2026-07-06', '2026-07-12');

        $oil = $list->items->where('name', 'olive oil');
        $this->assertCount(2, $oil);
        $this->assertEqualsCanonicalizing(['tbsp', 'ml'], $oil->pluck('unit')->all());
    }

    public function test_scale_factor_multiplies_quantities(): void
    {
        $recipe = $this->makeRecipe('a', [['name' => 'chicken thighs', 'quantity' => 800, 'unit' => 'g', 'note' => null, 'category' => 'meat']]);
        $this->assign($recipe, '2026-07-06', '2026-07-06', scale: 1.5);

        $list = $this->generate('2026-07-06', '2026-07-12');

        $chicken = $list->items->firstWhere('name', 'chicken thighs');
        $this->assertSame(1.2, $chicken->quantity);
        $this->assertSame('kg', $chicken->unit);
    }

    public function test_multi_day_batch_is_counted_once(): void
    {
        $recipe = $this->makeRecipe('a', [['name' => 'chicken thighs', 'quantity' => 800, 'unit' => 'g', 'note' => null, 'category' => 'meat']]);
        $this->assign($recipe, '2026-07-06', '2026-07-08');

        $list = $this->generate('2026-07-06', '2026-07-12');

        $chicken = $list->items->firstWhere('name', 'chicken thighs');
        $this->assertSame(800.0, $chicken->quantity);
    }

    public function test_batch_partially_overlapping_range_is_included_whole(): void
    {
        $recipe = $this->makeRecipe('a', [['name' => 'chicken thighs', 'quantity' => 800, 'unit' => 'g', 'note' => null, 'category' => 'meat']]);
        // Batch spans Sun–Tue; list range starts Mon.
        $this->assign($recipe, '2026-07-05', '2026-07-07');

        $list = $this->generate('2026-07-06', '2026-07-12');

        $chicken = $list->items->firstWhere('name', 'chicken thighs');
        $this->assertSame(800.0, $chicken->quantity);
    }

    public function test_two_separate_batches_of_the_same_recipe_both_count(): void
    {
        $recipe = $this->makeRecipe('a', [['name' => 'chicken thighs', 'quantity' => 800, 'unit' => 'g', 'note' => null, 'category' => 'meat']]);
        $this->assign($recipe, '2026-07-06', '2026-07-07');
        $this->assign($recipe, '2026-07-09', '2026-07-10');

        $list = $this->generate('2026-07-06', '2026-07-12');

        $chicken = $list->items->firstWhere('name', 'chicken thighs');
        $this->assertSame(1.6, $chicken->quantity);
        $this->assertSame('kg', $chicken->unit);
    }

    public function test_unquantified_items_appear_once_without_quantity(): void
    {
        $a = $this->makeRecipe('a', [['name' => 'salt', 'quantity' => null, 'unit' => null, 'note' => 'to taste', 'category' => 'pantry']]);
        $b = $this->makeRecipe('b', [['name' => 'salt', 'quantity' => null, 'unit' => null, 'note' => 'to taste', 'category' => 'pantry']]);
        $this->assign($a, '2026-07-06', '2026-07-06', scale: 2);
        $this->assign($b, '2026-07-07', '2026-07-07');

        $list = $this->generate('2026-07-06', '2026-07-12');

        $salt = $list->items->where('name', 'salt');
        $this->assertCount(1, $salt);
        $this->assertNull($salt->first()->quantity);
    }

    public function test_assignments_outside_range_are_excluded(): void
    {
        $recipe = $this->makeRecipe('a', [['name' => 'chicken thighs', 'quantity' => 800, 'unit' => 'g', 'note' => null, 'category' => 'meat']]);
        $this->assign($recipe, '2026-07-20', '2026-07-21');

        $list = $this->generate('2026-07-06', '2026-07-12');

        $this->assertCount(0, $list->items);
    }

    public function test_items_are_grouped_by_category_order(): void
    {
        $recipe = $this->makeRecipe('a', [
            ['name' => 'flour', 'quantity' => 500, 'unit' => 'g', 'note' => null, 'category' => 'pantry'],
            ['name' => 'carrots', 'quantity' => 2, 'unit' => 'whole', 'note' => null, 'category' => 'produce'],
            ['name' => 'beef mince', 'quantity' => 500, 'unit' => 'g', 'note' => null, 'category' => 'meat'],
        ]);
        $this->assign($recipe, '2026-07-06', '2026-07-06');

        $list = $this->generate('2026-07-06', '2026-07-12');

        $this->assertSame(['produce', 'meat', 'pantry'], $list->items->pluck('category')->all());
    }

    public function test_regenerate_preserves_checked_state_by_name_and_unit(): void
    {
        $recipe = $this->makeRecipe('a', [
            ['name' => 'chicken thighs', 'quantity' => 800, 'unit' => 'g', 'note' => null, 'category' => 'meat'],
            ['name' => 'rice', 'quantity' => 2, 'unit' => 'cup', 'note' => null, 'category' => 'pantry'],
        ]);
        $this->assign($recipe, '2026-07-06', '2026-07-06');

        $list = $this->generate('2026-07-06', '2026-07-12');
        $list->items->firstWhere('name', 'rice')->update(['checked_at' => now()]);

        // Add another batch, then regenerate.
        $other = $this->makeRecipe('b', [['name' => 'rice', 'quantity' => 1, 'unit' => 'cup', 'note' => null, 'category' => 'pantry']]);
        $this->assign($other, '2026-07-08', '2026-07-08');
        $list = app(ShoppingListGenerator::class)->generate($list->fresh());

        $rice = $list->items->firstWhere('name', 'rice');
        $this->assertSame(3.0, $rice->quantity);
        $this->assertNotNull($rice->checked_at, 'Checked state should survive regeneration');
        $this->assertNull($list->items->firstWhere('name', 'chicken thighs')->checked_at);
    }

    public function test_unit_aliases_merge(): void
    {
        $a = $this->makeRecipe('a', [['name' => 'butter', 'quantity' => 2, 'unit' => 'tablespoons', 'note' => null, 'category' => 'dairy']]);
        $b = $this->makeRecipe('b', [['name' => 'butter', 'quantity' => 1, 'unit' => 'tbsp', 'note' => null, 'category' => 'dairy']]);
        $this->assign($a, '2026-07-06', '2026-07-06');
        $this->assign($b, '2026-07-07', '2026-07-07');

        $list = $this->generate('2026-07-06', '2026-07-12');

        $butter = $list->items->where('name', 'butter');
        $this->assertCount(1, $butter);
        $this->assertSame(3.0, $butter->first()->quantity);
    }
}
