<?php

namespace Tests\Unit;

use App\Exceptions\RecipeParseException;
use App\Services\RecipeFileParser;
use PHPUnit\Framework\TestCase;

class RecipeFileParserTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = sys_get_temp_dir().'/recipe-parser-test-'.uniqid();
        mkdir($this->dir);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->dir.'/*'));
        rmdir($this->dir);
        parent::tearDown();
    }

    private function write(string $name, string $contents): string
    {
        $path = $this->dir.'/'.$name;
        file_put_contents($path, $contents);

        return $path;
    }

    public function test_parses_a_full_recipe(): void
    {
        $path = $this->write('test.md', <<<'MD'
        ---
        title: Test Bowl
        slug: test-bowl
        type: Dinner
        servings: 4
        protein: Chicken
        cost: low
        prep_minutes: 10
        tags: [quick, easy]
        custom_field: hello
        ingredients:
          - name: rice
            quantity: 1 1/2
            unit: cup
          - name: salt
            note: to taste
          - garlic
        ---
        ## Method
        Cook it.
        MD);

        $result = (new RecipeFileParser)->parse($path);
        $data = $result['data'];

        $this->assertSame('test-bowl', $data['slug']);
        $this->assertSame('Test Bowl', $data['title']);
        $this->assertSame('dinner', $data['type']);
        $this->assertSame('chicken', $data['protein']);
        $this->assertSame(4, $data['servings']);
        $this->assertSame(['quick', 'easy'], $data['tags']);
        $this->assertSame(['custom_field' => 'hello'], $data['meta']);
        $this->assertCount(3, $data['ingredients']);
        $this->assertSame(1.5, $data['ingredients'][0]['quantity']);
        $this->assertNull($data['ingredients'][1]['quantity']);
        $this->assertSame('to taste', $data['ingredients'][1]['note']);
        $this->assertSame('garlic', $data['ingredients'][2]['name']);
        $this->assertStringContainsString('Cook it.', $data['body_markdown']);
        $this->assertSame([], $result['warnings']);
    }

    public function test_slug_falls_back_to_filename_with_warning(): void
    {
        $path = $this->write('My Great Curry.md', <<<'MD'
        ---
        title: Curry
        servings: 2
        ingredients:
          - name: rice
        ---
        MD);

        $result = (new RecipeFileParser)->parse($path);

        $this->assertSame('my-great-curry', $result['data']['slug']);
        $this->assertNotEmpty($result['warnings']);
    }

    public function test_missing_servings_defaults_to_one_with_warning(): void
    {
        $path = $this->write('x.md', <<<'MD'
        ---
        title: X
        slug: x
        ingredients:
          - name: rice
        ---
        MD);

        $result = (new RecipeFileParser)->parse($path);

        $this->assertSame(1, $result['data']['servings']);
        $this->assertStringContainsString('servings', implode(' ', $result['warnings']));
    }

    public function test_missing_title_throws(): void
    {
        $path = $this->write('x.md', <<<'MD'
        ---
        slug: x
        ---
        Body
        MD);

        $this->expectException(RecipeParseException::class);
        (new RecipeFileParser)->parse($path);
    }

    public function test_no_frontmatter_throws(): void
    {
        $path = $this->write('x.md', '# Just some markdown');

        $this->expectException(RecipeParseException::class);
        (new RecipeFileParser)->parse($path);
    }

    public function test_broken_yaml_throws(): void
    {
        $path = $this->write('x.md', "---\ntitle: [unclosed\n---\nBody");

        $this->expectException(RecipeParseException::class);
        (new RecipeFileParser)->parse($path);
    }

    public function test_unreadable_quantity_becomes_null_with_warning(): void
    {
        $path = $this->write('x.md', <<<'MD'
        ---
        title: X
        slug: x
        servings: 2
        ingredients:
          - name: flour
            quantity: a handful
        ---
        MD);

        $result = (new RecipeFileParser)->parse($path);

        $this->assertNull($result['data']['ingredients'][0]['quantity']);
        $this->assertStringContainsString('flour', implode(' ', $result['warnings']));
    }
}
