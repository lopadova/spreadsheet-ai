<?php

declare(strict_types=1);

namespace App\Services\TabularReview;

use App\Models\TabularCell;
use App\Models\TabularReview;
use App\Support\TabularReview\PresetData;

/**
 * Find-or-create the {@see TabularReview} for a preset and build the JSON
 * payload the API returns: review meta, base columns, AI columns, rows (from
 * PresetData for display fidelity), and any existing persisted cells.
 */
class ReviewHydrator
{
    public function __construct(
        private readonly TabularReviewExtractor $extractor,
    ) {}

    /**
     * Find or create the review for a known preset key.
     */
    public function findOrCreate(string $presetKey): TabularReview
    {
        $preset = PresetData::preset($presetKey);

        $review = TabularReview::query()
            ->where('tenant_id', 'demo')
            ->where('preset_key', $presetKey)
            ->first();

        if ($review !== null) {
            return $review;
        }

        return TabularReview::query()->create([
            'tenant_id' => 'demo',
            'preset_key' => $presetKey,
            'title' => (string) ($preset['label'] ?? $presetKey),
            'row_source' => (string) ($preset['row_source'] ?? ''),
            'columns_config' => PresetData::columnsConfig($preset),
        ]);
    }

    /**
     * Build the full API payload for a review.
     *
     * @return array<string, mixed>
     */
    public function payload(TabularReview $review): array
    {
        $preset = PresetData::preset((string) $review->preset_key) ?? [];

        $rows = [];
        foreach (array_values($preset['rows'] ?? []) as $rowIndex => $row) {
            $rowId = $this->extractor->rowId($row, $rowIndex);
            $rows[] = array_merge(['row_id' => $rowId], $row);
        }

        $cells = TabularCell::query()
            ->where('review_id', $review->id)
            ->orderBy('row_id')
            ->orderBy('column_index')
            ->get()
            ->map(static fn (TabularCell $c) => [
                'row_id' => $c->row_id,
                'column_index' => $c->column_index,
                'content' => $c->content,
                'flag' => $c->flag,
                'confidence' => $c->confidence !== null ? (float) $c->confidence : null,
                'status' => $c->status,
            ])
            ->all();

        return [
            'review' => [
                'id' => $review->id,
                'preset_key' => $review->preset_key,
                'title' => $review->title,
                'row_source' => $review->row_source,
            ],
            'base_columns' => $preset['base_cols'] ?? [],
            'columns' => $review->columns_config ?? [],
            'rows' => $rows,
            'cells' => $cells,
            'suggestions_available' => true,
        ];
    }
}
