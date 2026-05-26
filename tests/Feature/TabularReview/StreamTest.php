<?php

declare(strict_types=1);

namespace Tests\Feature\TabularReview;

use App\Models\TabularReview;
use App\Support\TabularReview\PresetData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StreamTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['tabular.mock' => true, 'tabular.sse_pacing_ms' => 0]);
    }

    private function review(): TabularReview
    {
        $preset = PresetData::preset('returns');

        return TabularReview::query()->create([
            'tenant_id' => 'demo',
            'preset_key' => 'returns',
            'title' => 'Triage Resi',
            'row_source' => 'returns_rows',
            'columns_config' => PresetData::columnsConfig($preset),
        ]);
    }

    public function test_stream_is_event_stream_with_cells_and_done(): void
    {
        $review = $this->review();

        $res = $this->get("/api/reviews/{$review->id}/stream");

        $res->assertOk();
        $res->assertHeader('Content-Type', 'text/event-stream; charset=UTF-8');
        $res->assertHeader('Cache-Control', 'no-cache, private');
        $res->assertHeader('X-Accel-Buffering', 'no');

        $body = $res->streamedContent();

        $this->assertGreaterThanOrEqual(1, substr_count($body, 'event: cell'));
        $this->assertStringContainsString('event: done', $body);
    }

    public function test_stream_respects_cols_filter(): void
    {
        $review = $this->review();

        $body = $this->get("/api/reviews/{$review->id}/stream?cols=0")->streamedContent();

        // 14 returns rows, one column → 14 cell events.
        $this->assertSame(14, substr_count($body, 'event: cell'));
    }

    public function test_stream_unknown_review_is_404(): void
    {
        $this->get('/api/reviews/9999/stream')->assertNotFound();
    }
}
