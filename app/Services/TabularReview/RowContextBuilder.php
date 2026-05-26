<?php

declare(strict_types=1);

namespace App\Services\TabularReview;

/**
 * Builds the per-row context the engine works with.
 *
 * For this demo the PresetData row IS the context — it already holds the
 * entity display fields. We expose:
 *  - `contextArray()` — the PHP array used by {@see JsonPathResolver},
 *  - `contextJson()`  — the JSON string the LLM sees as user context.
 *
 * Keeping it a thin wrapper documents the seam where, in a real system, you
 * would hydrate related data (customer return history, order items, …) into
 * the context. Here the cooked preset row is sufficient.
 */
class RowContextBuilder
{
    /**
     * The array form used for json_path resolution.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public function contextArray(string $presetKey, array $row): array
    {
        return $row;
    }

    /**
     * The JSON context string handed to the LLM.
     *
     * @param  array<string, mixed>  $row
     */
    public function contextJson(string $presetKey, array $row): string
    {
        $encoded = json_encode(
            $this->contextArray($presetKey, $row),
            JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PARTIAL_OUTPUT_ON_ERROR,
        );

        return $encoded === false ? '{}' : $encoded;
    }
}
