<?php

declare(strict_types=1);

namespace Tests\Unit\TabularReview;

use App\Support\TabularReview\FormatType;
use PHPUnit\Framework\TestCase;

class FormatTypeTest extends TestCase
{
    public function test_there_are_17_format_types(): void
    {
        $this->assertCount(17, FormatType::cases());
        $this->assertCount(17, FormatType::values());
    }

    public function test_every_format_has_a_non_empty_prompt_suffix(): void
    {
        foreach (FormatType::cases() as $format) {
            $this->assertNotSame('', $format->promptSuffix(), "Empty suffix for {$format->value}");
        }
    }

    public function test_only_json_path_is_llm_free(): void
    {
        foreach (FormatType::cases() as $format) {
            if ($format === FormatType::JSON_PATH) {
                $this->assertTrue($format->isLlmFree());
            } else {
                $this->assertFalse($format->isLlmFree(), "{$format->value} should not be LLM-free");
            }
        }
    }

    public function test_enum_suffix_enumerates_supplied_values(): void
    {
        $suffix = FormatType::ENUM->promptSuffix(['Low', 'High']);
        $this->assertStringContainsString('Low / High', $suffix);
    }

    public function test_enum_status_default_lists_canonical_statuses(): void
    {
        $suffix = FormatType::ENUM_STATUS->promptSuffix();
        $this->assertStringContainsString('todo / in_progress / done / blocked', $suffix);
    }

    public function test_tags_multi_lists_allowed_values_when_supplied(): void
    {
        $suffix = FormatType::TAGS_MULTI->promptSuffix(['a', 'b']);
        $this->assertStringContainsString('a / b', $suffix);
    }
}
