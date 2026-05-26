<?php

declare(strict_types=1);

namespace Tests\Unit\TabularReview;

use App\Services\TabularReview\JsonPathResolver;
use PHPUnit\Framework\TestCase;

class JsonPathResolverTest extends TestCase
{
    private JsonPathResolver $resolver;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resolver = new JsonPathResolver();
    }

    public function test_resolves_dollar_dot_notation(): void
    {
        $data = ['action' => ['confidence' => 94]];
        $this->assertSame('94', $this->resolver->resolve('$.action.confidence', $data));
    }

    public function test_resolves_bare_dot_notation(): void
    {
        $data = ['a' => ['b' => 'value']];
        $this->assertSame('value', $this->resolver->resolve('a.b', $data));
    }

    public function test_resolves_bracket_notation(): void
    {
        $data = ['a' => ['b' => 'bracketed']];
        $this->assertSame('bracketed', $this->resolver->resolve("\$['a']['b']", $data));
    }

    public function test_boolean_true_stringifies_to_true(): void
    {
        $this->assertSame('true', $this->resolver->resolve('$.flag', ['flag' => true]));
    }

    public function test_boolean_false_stringifies_to_false(): void
    {
        $this->assertSame('false', $this->resolver->resolve('$.flag', ['flag' => false]));
    }

    public function test_missing_path_returns_null(): void
    {
        $this->assertNull($this->resolver->resolve('$.a.missing', ['a' => ['b' => 1]]));
    }

    public function test_array_value_is_json_encoded(): void
    {
        $this->assertSame('["x","y"]', $this->resolver->resolve('$.tags', ['tags' => ['x', 'y']]));
    }
}
