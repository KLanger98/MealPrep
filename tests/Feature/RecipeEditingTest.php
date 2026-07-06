<?php

namespace Tests\Feature;

use App\Models\MealAssignment;
use App\Models\Recipe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\TestCase;

class RecipeEditingTest extends TestCase
{
    use RefreshDatabase;

    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = sys_get_temp_dir().'/recipe-editing-test-'.uniqid();
        mkdir($this->dir);
        config(['recipes.path' => $this->dir]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->dir);
        parent::tearDown();
    }

    private function validContent(string $slug = 'garlic-bread', string $title = 'Garlic Bread'): string
    {
        return <<<MD
        ---
        title: {$title}
        slug: {$slug}
        type: component
        servings: 4
        ingredients:
          - name: baguette
            quantity: 1
            unit: whole
            category: bakery
        ---

        ## Method

        1. Butter, garlic, oven.
        MD;
    }

    public function test_creating_a_recipe_writes_the_file_and_indexes_it(): void
    {
        $this->post('/recipes', ['content' => $this->validContent()])
            ->assertRedirect('/recipes/garlic-bread');

        $this->assertFileExists($this->dir.'/garlic-bread.md');
        $this->assertNotNull(Recipe::firstWhere('slug', 'garlic-bread'));
    }

    public function test_invalid_content_is_rejected_and_nothing_is_written(): void
    {
        $this->post('/recipes', ['content' => "---\nslug: no-title\n---\nBody"])
            ->assertSessionHasErrors('content');

        $this->assertSame(0, Recipe::count());
        $this->assertSame([], glob($this->dir.'/*.md'));
    }

    public function test_duplicate_slug_is_rejected(): void
    {
        $this->post('/recipes', ['content' => $this->validContent()]);

        $this->post('/recipes', ['content' => $this->validContent(title: 'Other Garlic Bread')])
            ->assertSessionHasErrors('content');

        $this->assertSame(1, Recipe::count());
    }

    public function test_editing_updates_the_file_and_the_index(): void
    {
        $this->post('/recipes', ['content' => $this->validContent()]);

        $this->put('/recipes/garlic-bread', [
            'content' => $this->validContent(title: 'Cheesy Garlic Bread'),
        ])->assertRedirect('/recipes/garlic-bread');

        $this->assertStringContainsString('Cheesy Garlic Bread', file_get_contents($this->dir.'/garlic-bread.md'));
        $this->assertSame('Cheesy Garlic Bread', Recipe::firstWhere('slug', 'garlic-bread')->title);
    }

    public function test_changing_the_slug_via_edit_is_rejected(): void
    {
        $this->post('/recipes', ['content' => $this->validContent()]);

        $this->put('/recipes/garlic-bread', [
            'content' => $this->validContent(slug: 'renamed-bread'),
        ])->assertSessionHasErrors('content');

        $this->assertSame('garlic-bread', Recipe::first()->slug);
        $this->assertStringContainsString('slug: garlic-bread', file_get_contents($this->dir.'/garlic-bread.md'));
    }

    public function test_edit_page_shows_the_raw_file(): void
    {
        $this->post('/recipes', ['content' => $this->validContent()]);

        $this->get('/recipes/garlic-bread/edit')->assertStatus(200);
    }

    public function test_deleting_removes_file_row_and_assignments(): void
    {
        $this->post('/recipes', ['content' => $this->validContent()]);
        $recipe = Recipe::firstWhere('slug', 'garlic-bread');

        MealAssignment::create([
            'recipe_id' => $recipe->id,
            'date' => '2026-07-07',
            'slot' => 'dinner',
            'batch_id' => (string) Str::uuid(),
            'scale_factor' => 1,
        ]);

        $this->delete('/recipes/garlic-bread')->assertRedirect('/recipes');

        $this->assertFileDoesNotExist($this->dir.'/garlic-bread.md');
        $this->assertSame(0, Recipe::count());
        $this->assertSame(0, MealAssignment::count());
    }
}
