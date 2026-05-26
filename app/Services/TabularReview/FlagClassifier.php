<?php

declare(strict_types=1);

namespace App\Services\TabularReview;

use App\Support\TabularReview\CellFlag;

/**
 * Maps a {@see CellFlag} to a pseudo-confidence float.
 *
 * DEMO-ONLY: there is no reranker / confidence-score model here (the article
 * derives confidence from a KB reranker; see plan.md §1.B findings 10-11).
 * We derive a deterministic pseudo-confidence from the flag so the UI tint /
 * confidence dot still has a sensible value to render.
 */
class FlagClassifier
{
    private const MAP = [
        'green' => 0.92,
        'yellow' => 0.65,
        'grey' => 0.40,
        'red' => 0.20,
    ];

    public function confidenceFor(CellFlag $flag): float
    {
        return self::MAP[$flag->value] ?? 0.40;
    }
}
