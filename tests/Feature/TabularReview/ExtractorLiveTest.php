<?php

declare(strict_types=1);

namespace Tests\Feature\TabularReview;

use App\Models\TabularReview;
use App\Services\TabularReview\TabularReviewExtractor;
use App\Support\TabularReview\CellStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Ai\AnonymousAgent;
use Laravel\Ai\Ai;
use Tests\TestCase;

class ExtractorLiveTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['tabular.mock' => false]);
    }

    /**
     * A review with two LLM columns (0,1) and one json_path column (2).
     */
    private function review(): TabularReview
    {
        return TabularReview::query()->create([
            'tenant_id' => 'demo',
            'preset_key' => 'returns',
            'title' => 'Live test',
            'row_source' => 'returns_rows',
            'columns_config' => [
                ['index' => 0, 'name' => 'Reason', 'prompt' => 'Classify', 'format' => 'enum', 'enum_values' => ['A', 'B']],
                ['index' => 1, 'name' => 'Serial', 'prompt' => 'Serial?', 'format' => 'yes_no'],
                ['index' => 2, 'name' => 'Conf', 'prompt' => '$.meta.confidence', 'format' => 'json_path', 'json_path' => '$.meta.confidence'],
            ],
        ]);
    }

    public function test_parses_json_lines_into_cells_and_resolves_json_path(): void
    {
        Ai::fakeAgent(AnonymousAgent::class, [
            implode("\n", [
                '{"column_index":0,"summary":"A","flag":"green","reasoning":"clear","citations":["q1"]}',
                '{"column_index":1,"summary":"Yes","flag":"yellow","reasoning":"maybe","citations":[]}',
            ]),
        ]);

        $extractor = app(TabularReviewExtractor::class);
        $row = ['id' => 'RET-1', 'reason' => 'x', 'meta' => ['confidence' => 88]];

        $cells = $extractor->extractRow($this->review(), $row, 0, 'RET-1');

        $byIdx = collect($cells)->keyBy('column_index');

        $this->assertSame('A', $byIdx[0]->content['summary']);
        $this->assertSame('green', $byIdx[0]->flag);
        $this->assertSame(CellStatus::READY->value, $byIdx[0]->status);

        $this->assertSame('Yes', $byIdx[1]->content['summary']);
        $this->assertSame('yellow', $byIdx[1]->flag);

        // json_path column resolved LLM-free, flag grey.
        $this->assertSame('88', $byIdx[2]->content['summary']);
        $this->assertSame('grey', $byIdx[2]->flag);
    }

    public function test_missing_column_line_becomes_red_refusal(): void
    {
        // Only column 0 returned; column 1 missing → red refusal (R14).
        Ai::fakeAgent(AnonymousAgent::class, [
            '{"column_index":0,"summary":"A","flag":"green","reasoning":"ok","citations":[]}',
        ]);

        $extractor = app(TabularReviewExtractor::class);
        $row = ['id' => 'RET-1', 'meta' => ['confidence' => 90]];

        $cells = $extractor->extractRow($this->review(), $row, 0, 'RET-1');
        $byIdx = collect($cells)->keyBy('column_index');

        $this->assertSame('red', $byIdx[1]->flag);
        $this->assertNull($byIdx[1]->content['summary']);
        $this->assertSame(CellStatus::FAILED->value, $byIdx[1]->status);
    }

    public function test_empty_summary_becomes_red_refusal(): void
    {
        Ai::fakeAgent(AnonymousAgent::class, [
            implode("\n", [
                '{"column_index":0,"summary":null,"flag":"red"}',
                '{"column_index":1,"summary":"","flag":"green"}',
            ]),
        ]);

        $extractor = app(TabularReviewExtractor::class);
        $row = ['id' => 'RET-1', 'meta' => ['confidence' => 90]];

        $cells = $extractor->extractRow($this->review(), $row, 0, 'RET-1');
        $byIdx = collect($cells)->keyBy('column_index');

        $this->assertSame('red', $byIdx[0]->flag);
        $this->assertNull($byIdx[0]->content['summary']);
        $this->assertSame('red', $byIdx[1]->flag);
    }

    public function test_provider_exception_does_not_leak_raw_message(): void
    {
        $secret = 'SECRET_HOST api.internal.example.com KEY sk-leak-123';

        Ai::fakeAgent(AnonymousAgent::class, function () use ($secret) {
            throw new \RuntimeException($secret);
        });

        $extractor = app(TabularReviewExtractor::class);
        $row = ['id' => 'RET-1', 'meta' => ['confidence' => 90]];

        $cells = $extractor->extractRow($this->review(), $row, 0, 'RET-1');
        $byIdx = collect($cells)->keyBy('column_index');

        // Both LLM columns are red refusals; json_path col still resolves.
        foreach ([0, 1] as $idx) {
            $this->assertSame('red', $byIdx[$idx]->flag);
            $this->assertStringNotContainsString('SECRET_HOST', (string) $byIdx[$idx]->content['reasoning']);
            $this->assertStringNotContainsString('sk-leak-123', (string) $byIdx[$idx]->content['reasoning']);
            $this->assertStringNotContainsString('api.internal', (string) $byIdx[$idx]->content['reasoning']);
        }

        $this->assertSame('90', $byIdx[2]->content['summary']);
    }
}
