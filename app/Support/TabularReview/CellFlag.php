<?php

declare(strict_types=1);

namespace App\Support\TabularReview;

/**
 * Confidence flag for a tabular-review cell.
 *
 *  - green  → confident, single clear evidence
 *  - yellow → conflicting / partial evidence
 *  - grey   → present but ambiguous, or sourced from row metadata (json_path)
 *  - red    → no usable evidence / refusal (R14)
 */
enum CellFlag: string
{
    case GREEN = 'green';
    case GREY = 'grey';
    case YELLOW = 'yellow';
    case RED = 'red';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (CellFlag $c) => $c->value, self::cases());
    }
}
