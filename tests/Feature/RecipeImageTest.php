<?php

namespace Tests\Feature;

use App\Models\Recipe;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class RecipeImageTest extends TestCase
{
    use RefreshDatabase;

    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = sys_get_temp_dir().'/recipe-image-test-'.uniqid();
        mkdir($this->dir);
        config(['recipes.path' => $this->dir]);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->dir);
        parent::tearDown();
    }

    private function makeRecipe(array $overrides = []): Recipe
    {
        return Recipe::create([
            'slug' => 'test-recipe',
            'title' => 'Test Recipe',
            'type' => 'dinner',
            'servings' => 2,
            'tags' => [],
            'ingredients' => [],
            'file_path' => $this->dir.'/test-recipe.md',
            'file_mtime' => 1,
            'file_hash' => 'x',
            ...$overrides,
        ]);
    }

    private function writePng(string $relativePath): string
    {
        $path = $this->dir.'/'.$relativePath;
        File::ensureDirectoryExists(dirname($path));
        // Tiny valid 1x1 PNG.
        file_put_contents($path, base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        ));

        return $path;
    }

    public function test_sibling_image_with_same_basename_is_found(): void
    {
        touch($this->dir.'/test-recipe.md');
        $this->writePng('test-recipe.png');
        $recipe = $this->makeRecipe();

        $this->assertSame(realpath($this->dir.'/test-recipe.png'), $recipe->imagePath());
        $this->assertNotNull($recipe->imageUrl());
    }

    public function test_frontmatter_image_path_wins_over_sibling(): void
    {
        touch($this->dir.'/test-recipe.md');
        $this->writePng('test-recipe.png');
        $this->writePng('images/hero.png');
        $recipe = $this->makeRecipe(['image' => 'images/hero.png']);

        $this->assertSame(realpath($this->dir.'/images/hero.png'), $recipe->imagePath());
    }

    public function test_recipe_without_image_returns_null(): void
    {
        touch($this->dir.'/test-recipe.md');
        $recipe = $this->makeRecipe();

        $this->assertNull($recipe->imagePath());
        $this->assertNull($recipe->imageUrl());
    }

    public function test_missing_frontmatter_image_falls_back_to_sibling(): void
    {
        touch($this->dir.'/test-recipe.md');
        $this->writePng('test-recipe.jpg');
        $recipe = $this->makeRecipe(['image' => 'images/nope.png']);

        $this->assertSame(realpath($this->dir.'/test-recipe.jpg'), $recipe->imagePath());
    }

    public function test_paths_escaping_the_recipes_directory_are_rejected(): void
    {
        touch($this->dir.'/test-recipe.md');
        $outside = tempnam(sys_get_temp_dir(), 'outside').'.png';
        file_put_contents($outside, 'not really a png');
        $recipe = $this->makeRecipe(['image' => '../'.basename($outside)]);

        $this->assertNull($recipe->imagePath());

        unlink($outside);
    }

    public function test_image_route_serves_the_file(): void
    {
        touch($this->dir.'/test-recipe.md');
        $this->writePng('test-recipe.png');
        $this->makeRecipe();

        $this->get('/recipes/test-recipe/image')
            ->assertStatus(200)
            ->assertHeader('Content-Type', 'image/png');
    }

    public function test_image_route_404s_without_an_image(): void
    {
        touch($this->dir.'/test-recipe.md');
        $this->makeRecipe();

        $this->get('/recipes/test-recipe/image')->assertStatus(404);
    }
}
