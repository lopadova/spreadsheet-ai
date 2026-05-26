<?php

declare(strict_types=1);

namespace App\Services\TabularReview;

use App\Ai\AiException;
use App\Ai\TabularAiClient;
use App\Models\TabularCell;
use App\Models\TabularReview;
use App\Support\TabularReview\CellFlag;
use App\Support\TabularReview\CellStatus;
use App\Support\TabularReview\FormatType;
use App\Support\TabularReview\PresetData;
use Closure;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Heart of the M2 engine — extracts cells for a review, one row at a time.
 *
 * Two modes (config `tabular.mock`):
 *
 *  - MOCK (default): for every column, read the cooked cell from
 *    {@see PresetData} (matched by preset_key + column index + row index),
 *    normalized to {summary, flag, reasoning, citations}. Zero cost, offline.
 *
 *  - LIVE: json_path columns resolve LLM-free against the row JSON (flag
 *    grey). The remaining LLM columns go through ONE batched call per row →
 *    newline-delimited JSON, one object per `column_index`. R14: a missing
 *    line or empty summary → red refusal cell (summary null). Provider errors
 *    never leak (caught as {@see AiException}, generic reasoning).
 *
 * Persistence is an atomic DB upsert keyed `(review_id, row_id,
 * column_index)`, then re-`first()`. Content is JSON-encoded with
 * JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE — on JsonException the
 * cell degrades to red. Confidence is derived from the flag via
 * {@see FlagClassifier}.
 *
 * An optional `$onCell` closure is invoked per persisted cell (SSE hook).
 */
class TabularReviewExtractor
{
    public function __construct(
        private readonly TabularAiClient $ai,
        private readonly JsonPathResolver $jsonPath,
        private readonly RowContextBuilder $context,
        private readonly FlagClassifier $flags,
    ) {}

    /**
     * Extract all cells for ONE row.
     *
     * @param  array<string, mixed>  $row     the PresetData row array
     * @param  int  $rowIndex                  0-based position within the preset rows
     * @param  string  $rowId                  stable row id (natural code or index)
     * @param  list<int>|null  $columnIndexes  restrict to these column indexes (null = all)
     * @return list<TabularCell>
     */
    public function extractRow(
        TabularReview $review,
        array $row,
        int $rowIndex,
        string $rowId,
        ?Closure $onCell = null,
        ?array $columnIndexes = null,
    ): array {
        $columns = $this->normaliseColumns($review->columns_config ?? []);

        if ($columnIndexes !== null) {
            $columns = array_filter(
                $columns,
                static fn (int $idx) => in_array($idx, $columnIndexes, true),
                ARRAY_FILTER_USE_KEY,
            );
        }

        if ($columns === []) {
            return [];
        }

        $presetKey = (string) $review->preset_key;
        $persisted = [];

        if ($this->isMock()) {
            foreach ($columns as $idx => $col) {
                $cell = $this->persistMockCell($review, $rowId, $presetKey, $idx, $rowIndex);
                $persisted[] = $cell;
                $onCell?->__invoke($cell);
            }

            return $persisted;
        }

        // ── LIVE mode ──────────────────────────────────────────────────
        $contextArray = $this->context->contextArray($presetKey, $row);

        // Split json_path (LLM-free) vs LLM columns.
        $jsonPathColumns = [];
        $llmColumns = [];
        foreach ($columns as $idx => $col) {
            if ($col['format']->isLlmFree() && $col['json_path'] !== null) {
                $jsonPathColumns[$idx] = $col;
            } else {
                $llmColumns[$idx] = $col;
            }
        }

        // json_path path (free, flag grey).
        foreach ($jsonPathColumns as $idx => $col) {
            $value = $this->jsonPath->resolve($col['json_path'], $contextArray);

            if ($value === null) {
                $cell = $this->persistRefusal($review, $rowId, $idx, 'No value found at JSON path '.$col['json_path'].'.');
            } else {
                $cell = $this->persistCell($review, $rowId, $idx, CellStatus::READY, [
                    'summary' => $value,
                    'flag' => CellFlag::GREY->value,
                    'reasoning' => 'Sourced from row metadata at '.$col['json_path'].'.',
                    'citations' => [],
                ], CellFlag::GREY);
            }

            $persisted[] = $cell;
            $onCell?->__invoke($cell);
        }

        if ($llmColumns === []) {
            return $persisted;
        }

        // One batched LLM call for the remaining columns.
        $system = $this->buildSystemPrompt($llmColumns);
        $user = $this->buildUserPrompt($llmColumns, $contextArray);

        try {
            $raw = $this->ai->complete($system, $user);
            $parsed = $this->parseLlmResponse($raw);
        } catch (AiException $e) {
            // Real message already logged in TabularAiClient — never surface it.
            foreach ($llmColumns as $idx => $col) {
                $cell = $this->persistRefusal($review, $rowId, $idx, 'Extraction failed: provider error. See application log for details.');
                $persisted[] = $cell;
                $onCell?->__invoke($cell);
            }

            return $persisted;
        }

        foreach ($llmColumns as $idx => $col) {
            $line = $parsed[$idx] ?? null;

            if ($line === null) {
                $cell = $this->persistRefusal($review, $rowId, $idx, 'Model did not return a result for this column.');
                $persisted[] = $cell;
                $onCell?->__invoke($cell);
                continue;
            }

            $summary = isset($line['summary']) && $line['summary'] !== null ? (string) $line['summary'] : null;

            if ($summary === null || trim($summary) === '') {
                // R14: no-evidence → red refusal, summary null.
                $cell = $this->persistRefusal($review, $rowId, $idx, 'No evidence found for column "'.$col['name'].'".');
                $persisted[] = $cell;
                $onCell?->__invoke($cell);
                continue;
            }

            $flag = CellFlag::tryFrom((string) ($line['flag'] ?? CellFlag::GREEN->value)) ?? CellFlag::GREEN;
            $citations = $this->normaliseCitations($line['citations'] ?? []);

            $cell = $this->persistCell($review, $rowId, $idx, CellStatus::READY, [
                'summary' => $summary,
                'flag' => $flag->value,
                'reasoning' => isset($line['reasoning']) ? (string) $line['reasoning'] : '',
                'citations' => $citations,
            ], $flag);
            $persisted[] = $cell;
            $onCell?->__invoke($cell);
        }

        return $persisted;
    }

    /**
     * Convenience iterator: extract every row of the review's preset.
     *
     * @param  list<int>|null  $columnIndexes
     * @return list<TabularCell>
     */
    public function extractReview(
        TabularReview $review,
        ?Closure $onCell = null,
        ?array $columnIndexes = null,
        bool $force = false,
    ): array {
        $preset = PresetData::preset((string) $review->preset_key);
        $rows = $preset['rows'] ?? [];

        $all = [];
        foreach (array_values($rows) as $rowIndex => $row) {
            $rowId = $this->rowId($row, $rowIndex);
            $cells = $this->extractRow($review, $row, $rowIndex, $rowId, $onCell, $columnIndexes);
            foreach ($cells as $cell) {
                $all[] = $cell;
            }
        }

        return $all;
    }

    /**
     * Derive a stable row id from a preset row: prefer a natural code
     * (`id` like RET-1042 / ORD-… / C-…, or `sku` like ART-…), else the
     * 0-based index as string.
     *
     * @param  array<string, mixed>  $row
     */
    public function rowId(array $row, int $rowIndex): string
    {
        foreach (['id', 'sku'] as $key) {
            if (isset($row[$key]) && is_scalar($row[$key]) && (string) $row[$key] !== '') {
                return (string) $row[$key];
            }
        }

        return (string) $rowIndex;
    }

    private function isMock(): bool
    {
        return (bool) config('tabular.mock', true);
    }

    /**
     * Persist a cooked mock cell from PresetData, normalized to the canonical
     * {summary, flag, reasoning, citations} content DTO.
     */
    private function persistMockCell(
        TabularReview $review,
        string $rowId,
        string $presetKey,
        int $columnIndex,
        int $rowIndex,
    ): TabularCell {
        $cooked = PresetData::cookedCell($presetKey, $columnIndex, $rowIndex);

        if ($cooked === null) {
            return $this->persistRefusal($review, $rowId, $columnIndex, 'No cooked cell for this coordinate.');
        }

        $flag = CellFlag::tryFrom((string) $cooked['flag']) ?? CellFlag::GREY;

        return $this->persistCell($review, $rowId, $columnIndex, CellStatus::READY, [
            'summary' => $cooked['value'],
            'flag' => $flag->value,
            'reasoning' => '',
            'citations' => $cooked['citation'] !== null ? [['quote' => (string) $cooked['citation']]] : [],
        ], $flag);
    }

    /**
     * Normalise a columns_config payload into a typed list keyed by column
     * index. Defence-in-depth — the FormRequest validates upstream.
     *
     * @param  array<int, mixed>  $raw
     * @return array<int, array{name: string, prompt: string, format: FormatType, enum_values: list<string>, json_path: ?string}>
     */
    private function normaliseColumns(array $raw): array
    {
        $out = [];

        foreach (array_values($raw) as $position => $col) {
            if (! is_array($col)) {
                continue;
            }

            $idx = isset($col['index']) && is_numeric($col['index']) ? (int) $col['index'] : $position;
            $name = isset($col['name']) ? trim((string) $col['name']) : '';
            $prompt = isset($col['prompt']) ? trim((string) $col['prompt']) : '';
            $format = FormatType::tryFrom((string) ($col['format'] ?? FormatType::TEXT->value)) ?? FormatType::TEXT;

            $enumValues = [];
            if (isset($col['enum_values']) && is_array($col['enum_values'])) {
                foreach ($col['enum_values'] as $v) {
                    if (is_string($v) && trim($v) !== '') {
                        $enumValues[] = $v;
                    }
                }
            }

            $jsonPath = isset($col['json_path']) && is_string($col['json_path']) && trim($col['json_path']) !== ''
                ? trim($col['json_path'])
                : null;

            if ($name === '') {
                continue;
            }

            $out[$idx] = [
                'name' => $name,
                'prompt' => $prompt,
                'format' => $format,
                'enum_values' => $enumValues,
                'json_path' => $jsonPath,
            ];
        }

        return $out;
    }

    /**
     * @param  array<int, array{name: string, prompt: string, format: FormatType, enum_values: list<string>, json_path: ?string}>  $columns
     */
    private function buildSystemPrompt(array $columns): string
    {
        $lines = [
            'You are an information-extraction engine for a tabular-review tool.',
            'You will be given a single ROW of e-commerce data as JSON and a list of COLUMNS.',
            'For EACH column, output ONE line of JSON with this shape:',
            '{"column_index": <int>, "summary": <string>, "flag": "green"|"grey"|"yellow"|"red", "reasoning": <string>, "citations": [<string>]}',
            '',
            'Rules:',
            '- Output one JSON object per column, one per line.',
            '- Do NOT wrap the output in markdown fences.',
            '- If no evidence supports a column, set "flag": "red" and "summary": null.',
            '- Use "green" for a confident answer, "yellow" for conflicting evidence, "grey" when present but ambiguous.',
            '',
            'Columns:',
        ];

        foreach ($columns as $idx => $col) {
            $suffix = $col['format']->promptSuffix($col['enum_values']);
            $lines[] = sprintf(
                '  - column_index=%d  name="%s"  prompt="%s"  format=%s. %s',
                $idx,
                $col['name'],
                $col['prompt'] === '' ? $col['name'] : $col['prompt'],
                $col['format']->value,
                $suffix,
            );
        }

        return implode("\n", $lines);
    }

    /**
     * @param  array<int, array{name: string, prompt: string, format: FormatType, enum_values: list<string>, json_path: ?string}>  $columns
     * @param  array<string, mixed>  $contextArray
     */
    private function buildUserPrompt(array $columns, array $contextArray): string
    {
        $json = json_encode($contextArray, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

        return implode("\n", [
            'Row data:',
            $json === false ? '{}' : $json,
            '',
            'Now produce one JSON line per column, in order. Do not add any other text.',
        ]);
    }

    /**
     * Parse newline-delimited JSON into a map keyed by `column_index`.
     * Malformed lines are skipped.
     *
     * @return array<int, array<string, mixed>>
     */
    private function parseLlmResponse(string $content): array
    {
        $out = [];
        $content = trim($content);

        if ($content === '') {
            return [];
        }

        // Strip markdown fences if the model snuck them in.
        $content = preg_replace('/^```(?:json)?\s*|\s*```$/m', '', $content) ?? $content;

        foreach (preg_split('/\r?\n/', $content) ?: [] as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }

            $decoded = json_decode($line, true);
            if (! is_array($decoded) || ! isset($decoded['column_index']) || ! is_numeric($decoded['column_index'])) {
                continue;
            }

            $out[(int) $decoded['column_index']] = $decoded;
        }

        return $out;
    }

    /**
     * @return list<array{quote: string}>
     */
    private function normaliseCitations(mixed $raw): array
    {
        if (! is_array($raw)) {
            return [];
        }

        $out = [];
        foreach ($raw as $c) {
            if (is_string($c) && trim($c) !== '') {
                $out[] = ['quote' => $c];
            } elseif (is_array($c)) {
                $quote = $c['quote'] ?? $c['text'] ?? null;
                if (is_string($quote) && trim($quote) !== '') {
                    $out[] = ['quote' => $quote];
                }
            }
        }

        return $out;
    }

    /**
     * Persist a cell idempotently via a true DB-level upsert keyed by the
     * composite UNIQUE (review_id, row_id, column_index), then re-`first()`.
     *
     * `updateOrCreate` is NOT atomic (SELECT then INSERT/UPDATE) and races on
     * the composite UNIQUE; `upsert()` issues a single INSERT ... ON CONFLICT
     * statement.
     *
     * @param  array<string, mixed>  $content
     */
    private function persistCell(
        TabularReview $review,
        string $rowId,
        int $columnIndex,
        CellStatus $status,
        array $content,
        CellFlag $flag,
    ): TabularCell {
        $now = Carbon::now();

        try {
            $encoded = json_encode(
                $content,
                JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE,
            );
        } catch (\JsonException $e) {
            Log::warning('TabularReviewExtractor cell content encode failed', [
                'review_id' => $review->id,
                'row_id' => $rowId,
                'column_index' => $columnIndex,
                'message' => $e->getMessage(),
            ]);

            // Degrade to an encode-safe red refusal so the failure is visible.
            $content = [
                'summary' => null,
                'flag' => CellFlag::RED->value,
                'reasoning' => 'Extracted content failed JSON encoding.',
                'citations' => [],
            ];
            $encoded = json_encode($content, JSON_UNESCAPED_UNICODE);
            $status = CellStatus::FAILED;
            $flag = CellFlag::RED;
        }

        $confidence = $this->flags->confidenceFor($flag);

        TabularCell::query()->upsert(
            [[
                'tenant_id' => 'demo',
                'review_id' => $review->id,
                'row_id' => $rowId,
                'column_index' => $columnIndex,
                'content' => $encoded,
                'status' => $status->value,
                'flag' => $flag->value,
                'confidence' => $confidence,
                'generated_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]],
            uniqueBy: ['review_id', 'row_id', 'column_index'],
            update: ['content', 'status', 'flag', 'confidence', 'generated_at', 'updated_at'],
        );

        /** @var TabularCell $cell */
        $cell = TabularCell::query()
            ->where('review_id', $review->id)
            ->where('row_id', $rowId)
            ->where('column_index', $columnIndex)
            ->firstOrFail();

        return $cell;
    }

    private function persistRefusal(
        TabularReview $review,
        string $rowId,
        int $columnIndex,
        string $reason,
    ): TabularCell {
        return $this->persistCell($review, $rowId, $columnIndex, CellStatus::FAILED, [
            'summary' => null,
            'flag' => CellFlag::RED->value,
            'reasoning' => $reason,
            'citations' => [],
        ], CellFlag::RED);
    }
}
