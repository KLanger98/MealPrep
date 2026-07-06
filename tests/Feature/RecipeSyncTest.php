<?php

namespace Tests\Feature;

use App\Models\Recipe;
use App\Models\RecipeImportError;
use App\Services\RecipeSyncer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class RecipeSyncTest extends TestCase
{
    use RefreshDatabase;

    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = sys_get_temp_dir().'/recipe-sync-test-'.uniqid();
        mkdir($this->dir);
        config(['recipes.path' => $this->dir]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->dir);
        parent::tearDown();
    }

    private function writeRecipe(string $file, string $slug, string $title = 'A Recipe'): string
    {
        $path = $this->dir.'/'.$file;
        file_put_contents($path, <<<MD
        ---
        title: {$title}
        slug: {$slug}
        servings: 2
        ingredients:
          - name: rice
            quantity: 1
            unit: cup
        ---
        ## Method
        Cook.
        MD);

        return $path;
    }

    private function sync(): array
    {
        return app(RecipeSyncer::class)->sync();
    }

    public function test_new_files_are_indexed(): void
    {
        $this->writeRecipe('one.md', 'one');
        $this->writeRecipe('two.md', 'two');

        $result = $this->sync();

        $this->assertCount(2, $result['created']);
        $this->assertSame(2, Recipe::count());
    }

    public function test_unchanged_files_are_skipped_on_resync(): void
    {
        $this->writeRecipe('one.md', 'one');

        $this->sync();
        $result = $this->sync();

        $this->assertSame([], $result['created']);
        $this->assertSame(['one'], $result['unchanged']);
    }

    public function test_edited_files_are_reparsed(): void
    {
        $path = $this->writeRecipe('one.md', 'one', 'Old Title');
        $this->sync();

        $this->writeRecipe('one.md', 'one', 'New Title');
        touch($path, time() + 5);

        $result = $this->sync();

        $this->assertSame(['one'], $result['updated']);
        $this->assertSame('New Title', Recipe::firstWhere('slug', 'one')->title);
    }

    public function test_renamed_file_with_same_slug_updates_in_place(): void
    {
        $path = $this->writeRecipe('old-name.md', 'stable-slug');
        $this->sync();

        rename($path, $this->dir.'/new-name.md');
        $this->sync();

        $this->assertSame(1, Recipe::count());
        $recipe = Recipe::firstWhere('slug', 'stable-slug');
        $this->assertStringEndsWith('new-name.md', $recipe->file_path);
        $this->assertNull($recipe->missing_at);
    }

    public function test_deleted_files_are_marked_missing_not_deleted(): void
    {
        $path = $this->writeRecipe('one.md', 'one');
        $this->sync();

        unlink($path);
        $result = $this->sync();

        $this->assertSame(['one'], $result['missing']);
        $recipe = Recipe::firstWhere('slug', 'one');
        $this->assertNotNull($recipe->missing_at);

        // File comes back -> missing flag clears.
        $this->writeRecipe('one.md', 'one');
        $this->sync();
        $this->assertNull($recipe->fresh()->missing_at);
    }

    public function test_invalid_files_are_skipped_and_recorded(): void
    {
        $this->writeRecipe('good.md', 'good');
        file_put_contents($this->dir.'/bad.md', "---\ntitle: [broken\n---\nBody");

        $result = $this->sync();

        $this->assertCount(1, $result['errors']);
        $this->assertSame(1, Recipe::count());
        $this->assertSame(1, RecipeImportError::where('level', 'error')->count());
    }

    public function test_duplicate_slugs_keep_first_file_and_record_error(): void
    {
        $this->writeRecipe('a.md', 'same-slug');
        $this->writeRecipe('b.md', 'same-slug');

        $result = $this->sync();

        $this->assertSame(1, Recipe::count());
        $this->assertCount(1, $result['errors']);
        $this->assertStringContainsString('Duplicate slug', RecipeImportError::where('level', 'error')->first()->message);
    }

    public function test_schema_and_readme_files_are_ignored(): void
    {
        file_put_contents($this->dir.'/SCHEMA.md', '# Not a recipe');
        $this->writeRecipe('one.md', 'one');

        $result = $this->sync();

        $this->assertSame([], $result['errors']);
        $this->assertSame(1, Recipe::count());
    }

    public function test_subdirectories_are_scanned(): void
    {
        mkdir($this->dir.'/dinners');
        $this->writeRecipe('dinners/nested.md', 'nested');

        $this->sync();

        $this->assertSame(1, Recipe::count());
    }

    public function test_import_errors_are_cleared_on_each_sync(): void
    {
        $bad = $this->dir.'/bad.md';
        file_put_contents($bad, "---\ntitle: [broken\n---\n");
        $this->sync();
        $this->assertSame(1, RecipeImportError::count());

        unlink($bad);
        $this->sync();
        $this->assertSame(0, RecipeImportError::count());
    }
}
