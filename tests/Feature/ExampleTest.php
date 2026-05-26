<?php

namespace Tests\Feature;

// use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     */
    public function test_the_application_returns_a_successful_response(): void
    {
        // The `/` view uses @vite(); stub the manifest so the test does not
        // depend on a prior `npm run build` (CI runs phpunit before build).
        $this->withoutVite();

        $response = $this->get('/');

        $response->assertStatus(200);
    }
}
