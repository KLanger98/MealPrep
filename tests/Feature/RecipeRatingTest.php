<?php

namespace Tests\Feature;

use App\Models\Recipe;
use App\Services\RecipeSyncer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class RecipeRatingTest extends TestCase
{
    use RefreshDatabase;

    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = sys_get_temp_dir().'/recipe-rating-test-'.uniqid();
        mkdir($this->dir);
        config(['recipes.path' => $this->dir]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->dir);
        parent::tearDown();
    }

    private function writeAndSync(string $extraFrontmatter = ''): Recipe
    {
        file_put_contents($this->dir.'/pasta.md', <<<MD
        ---
        title: Pasta
        slug: pasta
        servings: 2
        {$extraFrontmatter}
        ingredients:
          - name: spaghetti
            quantity: 200
            unit: g
        ---

        ## Method

        1. Boil.
        MD);

        app(RecipeSyncer::class)->sync();

        return Recipe::firstWhere('slug', 'pasta');
    }

    public function test_rating_is_added_to_the_frontmatter(): void
    {
        $this->writeAndSync();

        $this->patch('/recipes/pasta/rating', ['rating' => 8])->assertRedirect();

        $contents = file_get_contents($this->dir.'/pasta.md');
        $this->assertStringContainsString('rating: 8', $contents);
        $this->assertSame(8.0, Recipe::firstWhere('slug', 'pasta')->rating);
        // Body untouched.
        $this->assertStringContainsString('1. Boil.', $contents);
    }

    public function test_existing_rating_line_is_replaced(): void
    {
        $this->writeAndSync('rating: 3');

        $this->patch('/recipes/pasta/rating', ['rating' => 9.5]);

        $contents = file_get_contents($this->dir.'/pasta.md');
        $this->assertStringContainsString('rating: 9.5', $contents);
        $this->assertStringNotContainsString('rating: 3', $contents);
        $this->assertSame(1, substr_count($contents, 'rating:'));
    }

    public function test_null_clears_the_rating(): void
    {
        $this->writeAndSync('rating: 7');

        $this->patch('/recipes/pasta/rating', ['rating' => null]);

        $this->assertStringNotContainsString('rating:', file_get_contents($this->dir.'/pasta.md'));
        $this->assertNull(Recipe::firstWhere('slug', 'pasta')->rating);
    }

    public function test_out_of_range_rating_is_rejected(): void
    {
        $this->writeAndSync();

        $this->patch('/recipes/pasta/rating', ['rating' => 11])->assertSessionHasErrors('rating');
        $this->patch('/recipes/pasta/rating', ['rating' => -1])->assertSessionHasErrors('rating');

        $this->assertStringNotContainsString('rating:', file_get_contents($this->dir.'/pasta.md'));
    }

    public function test_source_and_rating_are_parsed_from_frontmatter(): void
    {
        $recipe = $this->writeAndSync("source: https://www.recipetineats.com/pasta/\nrating: 7.5");

        $this->assertSame('https://www.recipetineats.com/pasta/', $recipe->source);
        $this->assertSame(7.5, $recipe->rating);
    }

    public function test_invalid_frontmatter_rating_is_ignored_with_warning(): void
    {
        $recipe = $this->writeAndSync('rating: eleven');

        $this->assertNull($recipe->rating);
    }
}
