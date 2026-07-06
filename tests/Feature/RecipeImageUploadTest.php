<?php

namespace Tests\Feature;

use App\Models\Recipe;
use App\Services\RecipeSyncer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Tests\TestCase;

class RecipeImageUploadTest extends TestCase
{
    use RefreshDatabase;

    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = sys_get_temp_dir().'/recipe-upload-test-'.uniqid();
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

    public function test_upload_stores_a_sibling_image(): void
    {
        $this->writeAndSync();

        $this->post('/recipes/pasta/image', [
            'photo' => UploadedFile::fake()->image('phone-photo.jpg', 500, 400),
        ])->assertRedirect();

        $this->assertFileExists($this->dir.'/pasta.jpg');
        $this->assertSame(realpath($this->dir.'/pasta.jpg'), Recipe::firstWhere('slug', 'pasta')->imagePath());
    }

    public function test_upload_replaces_an_existing_image_with_a_different_extension(): void
    {
        $this->writeAndSync();
        $this->post('/recipes/pasta/image', ['photo' => UploadedFile::fake()->image('a.png', 100, 100)]);

        $this->post('/recipes/pasta/image', ['photo' => UploadedFile::fake()->image('b.jpg', 100, 100)]);

        $this->assertFileDoesNotExist($this->dir.'/pasta.png');
        $this->assertFileExists($this->dir.'/pasta.jpg');
    }

    public function test_upload_removes_a_shadowing_frontmatter_image_line(): void
    {
        $recipe = $this->writeAndSync('image: images/old.jpg');

        $this->post('/recipes/pasta/image', ['photo' => UploadedFile::fake()->image('new.jpg', 100, 100)]);

        $contents = file_get_contents($this->dir.'/pasta.md');
        $this->assertStringNotContainsString('image:', $contents);
        $this->assertStringContainsString('1. Boil.', $contents);
        $this->assertSame(realpath($this->dir.'/pasta.jpg'), $recipe->fresh()->imagePath());
    }

    public function test_large_uploads_are_downscaled(): void
    {
        $this->writeAndSync();

        $this->post('/recipes/pasta/image', [
            'photo' => UploadedFile::fake()->image('huge.jpg', 3200, 2400),
        ]);

        [$width, $height] = getimagesize($this->dir.'/pasta.jpg');
        $this->assertSame(1600, $width);
        $this->assertSame(1200, $height);
    }

    public function test_non_images_are_rejected(): void
    {
        $this->writeAndSync();

        $this->post('/recipes/pasta/image', [
            'photo' => UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf'),
        ])->assertSessionHasErrors('photo');

        $this->assertSame([], Recipe::firstWhere('slug', 'pasta')->siblingImagePaths());
    }

    public function test_destroy_removes_the_image_and_frontmatter_line(): void
    {
        $this->writeAndSync();
        $this->post('/recipes/pasta/image', ['photo' => UploadedFile::fake()->image('a.jpg', 100, 100)]);

        $this->delete('/recipes/pasta/image')->assertRedirect();

        $this->assertFileDoesNotExist($this->dir.'/pasta.jpg');
        $this->assertNull(Recipe::firstWhere('slug', 'pasta')->imagePath());
    }
}
