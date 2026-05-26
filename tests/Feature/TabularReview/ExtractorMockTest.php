<?php

declare(strict_types=1);

namespace Tests\Feature\TabularReview;

use App\Models\TabularReview;
use App\Services\TabularReview\TabularReviewExtractor;
use App\Support\TabularReview\CellStatus;
use App\Support\TabularReview\PresetData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExtractorMockTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['tabular.mock' => true]);
    }

    private function returnsReview(): TabularReview
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

    public function test_mock_cells_match_cooked_preset_values(): void
    {
        $review = $this->returnsReview();
        $extractor = app(TabularReviewExtractor::class);

        $preset = PresetData::preset('returns');
        $row = $preset['rows'][0]; // RET-1042

        $cells = $extractor->extractRow($review, $row, 0, 'RET-1042');

        $this->assertCount(count($preset['ai_cols']), $cells);

        // Column 0 = reason_sem → 'Wrong Size', flag green.
        $reasonSem = collect($cells)->firstWhere('column_index', 0);
        $this->assertSame('Wrong Size', $reasonSem->content['summary']);
        $this->assertSame('green', $reasonSem->content['flag']);
        $this->assertSame('green', $reasonSem->flag);
        $this->assertSame(CellStatus::READY->value, $reasonSem->status);
        $this->assertSame(0.92, (float) $reasonSem->confidence);

        // Column 3 = risk → cooked yellow on a later row; row 0 is green=1.
        $risk = collect($cells)->firstWhere('column_index', 3);
        $this->assertSame(1, $risk->content['summary']);
        $this->assertSame('green', $risk->flag);
    }

    public function test_yellow_cell_gets_yellow_confidence(): void
    {
        $review = $this->returnsReview();
        $extractor = app(TabularReviewExtractor::class);
        $preset = PresetData::preset('returns');

        // Row index 2 (RET-1044): reason_sem cooked as 'Not As Described' / yellow.
        $cells = $extractor->extractRow($review, $preset['rows'][2], 2, 'RET-1044');
        $reasonSem = collect($cells)->firstWhere('column_index', 0);

        $this->assertSame('yellow', $reasonSem->flag);
        $this->assertSame(0.65, (float) $reasonSem->confidence);
    }

    public function test_reextracting_updates_in_place_one_row_per_coordinate(): void
    {
        $review = $this->returnsReview();
        $extractor = app(TabularReviewExtractor::class);
        $preset = PresetData::preset('returns');
        $row = $preset['rows'][0];

        $extractor->extractRow($review, $row, 0, 'RET-1042');
        $extractor->extractRow($review, $row, 0, 'RET-1042');

        $count = $review->cells()
            ->where('row_id', 'RET-1042')
            ->where('column_index', 0)
            ->count();

        $this->assertSame(1, $count);
    }

    public function test_extract_review_iterates_all_rows(): void
    {
        $review = $this->returnsReview();
        $extractor = app(TabularReviewExtractor::class);

        $seen = [];
        $extractor->extractReview($review, function ($cell) use (&$seen): void {
            $seen[] = $cell->row_id;
        });

        $preset = PresetData::preset('returns');
        $expectedCells = count($preset['rows']) * count($preset['ai_cols']);

        $this->assertSame($expectedCells, $review->cells()->count());
        $this->assertContains('RET-1042', $seen);
        $this->assertContains('RET-1055', $seen);
    }
}
