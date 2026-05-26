<?php

declare(strict_types=1);

namespace App\Support\TabularReview;

/**
 * Lifecycle status of a tabular-review cell.
 *
 *  - pending    → cleared / awaiting (re)generation
 *  - generating → in-flight (LLM call or stream)
 *  - ready      → value persisted
 *  - failed     → refusal / provider error (paired with a red flag)
 */
enum CellStatus: string
{
    case PENDING = 'pending';
    case GENERATING = 'generating';
    case READY = 'ready';
    case FAILED = 'failed';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (CellStatus $c) => $c->value, self::cases());
    }
}
