<?php

namespace Tests\Unit;

use Tests\TestCase;

class ConfigTest extends TestCase
{
    public function test_ai_default_provider_is_anthropic(): void
    {
        $this->assertSame('anthropic', config('ai.default'));
    }

    public function test_anthropic_provider_is_configured(): void
    {
        $this->assertSame('anthropic', config('ai.providers.anthropic.driver'));
    }

    public function test_tabular_mock_is_true_by_default(): void
    {
        $this->assertTrue(config('tabular.mock'));
    }

    public function test_tabular_defaults(): void
    {
        $this->assertSame('anthropic', config('tabular.provider'));
        $this->assertSame('claude-haiku-4-5', config('tabular.model'));
        $this->assertSame(1200, config('tabular.max_tokens'));
        $this->assertSame(0.1, config('tabular.temperature'));
    }
}
