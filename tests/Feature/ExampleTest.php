<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_root_url_redirects_to_recipes(): void
    {
        $response = $this->get('/');

        $response->assertRedirect('/recipes');
    }

    public function test_the_recipes_page_renders(): void
    {
        $response = $this->get('/recipes');

        $response->assertStatus(200);
    }
}
