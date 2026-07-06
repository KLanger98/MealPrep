<?php

namespace Tests\Feature;

use App\Models\MealAssignment;
use App\Models\Recipe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MealAssignmentTest extends TestCase
{
    use RefreshDatabase;

    private function makeRecipe(string $slug = 'test-recipe'): Recipe
    {
        return Recipe::create([
            'slug' => $slug,
            'title' => ucwords(str_replace('-', ' ', $slug)),
            'type' => 'dinner',
            'servings' => 4,
            'tags' => [],
            'ingredients' => [
                ['name' => 'rice', 'quantity' => 2, 'unit' => 'cup', 'note' => null, 'category' => 'pantry'],
            ],
            'file_path' => "/fake/{$slug}.md",
            'file_mtime' => 1,
            'file_hash' => md5($slug),
        ]);
    }

    public function test_assigning_across_multiple_days_creates_one_row_per_day_sharing_a_batch(): void
    {
        $recipe = $this->makeRecipe();

        $this->post('/assignments', [
            'recipe_id' => $recipe->id,
            'slot' => 'lunch',
            'start_date' => '2026-07-06',
            'end_date' => '2026-07-08',
            'scale_factor' => 1.5,
        ])->assertRedirect();

        $assignments = MealAssignment::orderBy('date')->get();

        $this->assertCount(3, $assignments);
        $this->assertSame(['2026-07-06', '2026-07-07', '2026-07-08'], $assignments->map(fn ($a) => $a->date->toDateString())->all());
        $this->assertSame(1, $assignments->pluck('batch_id')->unique()->count());
        $this->assertSame([1.5, 1.5, 1.5], $assignments->pluck('scale_factor')->all());
    }

    public function test_single_day_assignment_still_gets_a_batch_id(): void
    {
        $recipe = $this->makeRecipe();

        $this->post('/assignments', [
            'recipe_id' => $recipe->id,
            'slot' => 'dinner',
            'start_date' => '2026-07-06',
            'end_date' => '2026-07-06',
            'scale_factor' => 1,
        ]);

        $this->assertNotNull(MealAssignment::first()->batch_id);
    }

    public function test_invalid_slot_is_rejected(): void
    {
        $recipe = $this->makeRecipe();

        $this->post('/assignments', [
            'recipe_id' => $recipe->id,
            'slot' => 'brunch',
            'start_date' => '2026-07-06',
            'end_date' => '2026-07-06',
            'scale_factor' => 1,
        ])->assertSessionHasErrors('slot');
    }

    public function test_deleting_one_day_keeps_the_rest_of_the_batch(): void
    {
        $recipe = $this->makeRecipe();
        $this->post('/assignments', [
            'recipe_id' => $recipe->id,
            'slot' => 'lunch',
            'start_date' => '2026-07-06',
            'end_date' => '2026-07-08',
            'scale_factor' => 1,
        ]);

        $tuesday = MealAssignment::whereDate('date', '2026-07-07')->first();
        $this->delete("/assignments/{$tuesday->id}")->assertRedirect();

        $this->assertSame(2, MealAssignment::count());
        $this->assertNull(MealAssignment::whereDate('date', '2026-07-07')->first());
    }

    public function test_deleting_a_batch_removes_all_days(): void
    {
        $recipe = $this->makeRecipe();
        $this->post('/assignments', [
            'recipe_id' => $recipe->id,
            'slot' => 'lunch',
            'start_date' => '2026-07-06',
            'end_date' => '2026-07-08',
            'scale_factor' => 1,
        ]);

        $batchId = MealAssignment::first()->batch_id;
        $this->delete("/assignments/batch/{$batchId}")->assertRedirect();

        $this->assertSame(0, MealAssignment::count());
    }

    public function test_updating_a_batch_changes_scale_on_every_day(): void
    {
        $recipe = $this->makeRecipe();
        $this->post('/assignments', [
            'recipe_id' => $recipe->id,
            'slot' => 'lunch',
            'start_date' => '2026-07-06',
            'end_date' => '2026-07-08',
            'scale_factor' => 1,
        ]);

        $batchId = MealAssignment::first()->batch_id;
        $this->patch("/assignments/batch/{$batchId}", ['scale_factor' => 2, 'slot' => 'dinner'])->assertRedirect();

        $this->assertSame([2.0, 2.0, 2.0], MealAssignment::pluck('scale_factor')->all());
        $this->assertSame(['dinner'], MealAssignment::distinct()->pluck('slot')->all());
    }

    public function test_calendar_week_param_selects_that_week(): void
    {
        // A Wednesday: the page should snap to Monday of the same week.
        $this->get('/calendar?week=2026-07-15')
            ->assertStatus(200)
            ->assertInertia(fn ($page) => $page->where('weekStart', '2026-07-13'));
    }

    public function test_calendar_page_renders_with_assignments(): void
    {
        $recipe = $this->makeRecipe();
        $this->post('/assignments', [
            'recipe_id' => $recipe->id,
            'slot' => 'lunch',
            'start_date' => now()->startOfWeek()->toDateString(),
            'end_date' => now()->startOfWeek()->addDays(2)->toDateString(),
            'scale_factor' => 1.5,
        ]);

        $this->get('/calendar')->assertStatus(200);
    }
}
