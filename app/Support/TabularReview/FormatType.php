<?php

declare(strict_types=1);

namespace App\Support\TabularReview;

/**
 * Format types for tabular-review columns — the single source of truth.
 *
 * Ported from AskMyDocs (`app/Support/TabularReview/FormatType.php`): 17
 * format types — Mike's 9 (text / bulleted_list / number / percentage /
 * monetary_amount / currency / yes_no / date / tag) plus 8 more (enum /
 * enum_status / rating / url / person / tags_multi / relation / json_path).
 *
 * Each case contributes a prompt suffix injected after the column
 * instruction so the LLM produces output the cell renderer + validator can
 * trust.
 *
 * The `json_path` case is special — it is the LLM-FREE short-circuit (cf.
 * `isLlmFree()`): the extractor reads the value directly from the serialized
 * row JSON via a JSON-path lookup. No LLM call is issued for those columns.
 *
 * Adding a new format requires: new case here + suffix in `promptSuffix()`
 * + validator entry (FormRequest) + cell renderer (frontend).
 */
enum FormatType: string
{
    case TEXT = 'text';
    case BULLETED_LIST = 'bulleted_list';
    case NUMBER = 'number';
    case PERCENTAGE = 'percentage';
    case MONETARY_AMOUNT = 'monetary_amount';
    case CURRENCY = 'currency';
    case YES_NO = 'yes_no';
    case DATE = 'date';
    case TAG = 'tag';
    case ENUM = 'enum';
    case ENUM_STATUS = 'enum_status';
    case RATING = 'rating';
    case URL = 'url';
    case PERSON = 'person';
    case TAGS_MULTI = 'tags_multi';
    case RELATION = 'relation';
    case JSON_PATH = 'json_path';

    /**
     * Returns the prompt-suffix string injected after a column's
     * instruction. The wording is deliberately strict so the LLM outputs
     * something the validator can accept.
     *
     * For ENUM / ENUM_STATUS / TAGS_MULTI the caller passes the configured
     * option set so the prompt enumerates allowed values.
     *
     * @param  array<int, string>  $enumValues
     */
    public function promptSuffix(array $enumValues = []): string
    {
        return match ($this) {
            self::TEXT => 'Respond with a concise text answer (max 200 chars).',
            self::BULLETED_LIST => 'Respond as a markdown bulleted list with "- " items.',
            self::NUMBER => 'Respond with a single number, nothing else.',
            self::PERCENTAGE => 'Respond with a percentage in 0-100% (one decimal digit allowed).',
            self::MONETARY_AMOUNT => 'Respond with a monetary amount followed by its ISO-4217 currency code.',
            self::CURRENCY => 'Respond with a 3-letter ISO-4217 currency code (e.g. EUR, USD, GBP).',
            self::YES_NO => 'Answer Yes or No only.',
            self::DATE => 'Respond with an ISO-8601 date in YYYY-MM-DD format.',
            self::TAG => 'Respond with one short label (1-3 words).',
            self::ENUM => $this->enumPrompt($enumValues),
            self::ENUM_STATUS => $this->enumStatusPrompt($enumValues),
            self::RATING => 'Respond with a rating 1-5 (1=worst, 5=best).',
            self::URL => 'Respond with a single URL starting with https://.',
            self::PERSON => 'Respond with the person\'s email or full name.',
            self::TAGS_MULTI => $this->tagsMultiPrompt($enumValues),
            self::RELATION => 'Respond with the related entity label or id (e.g. clienti:24891).',
            self::JSON_PATH => 'Respond with the value extracted from row metadata.',
        };
    }

    /**
     * True when this format MUST NOT issue an LLM call — value comes from
     * another source (the serialized row JSON via JSON Path).
     */
    public function isLlmFree(): bool
    {
        return $this === self::JSON_PATH;
    }

    /**
     * Return every enum value as a flat string list. Useful for validators
     * and route-contract docs.
     *
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(static fn (FormatType $c) => $c->value, self::cases());
    }

    /**
     * @param  array<int, string>  $enumValues
     */
    private function enumPrompt(array $enumValues): string
    {
        if ($enumValues === []) {
            return 'Answer with exactly one allowed option.';
        }

        $list = implode(' / ', $enumValues);

        return "Answer with EXACTLY one of: {$list}.";
    }

    /**
     * @param  array<int, string>  $enumValues
     */
    private function enumStatusPrompt(array $enumValues): string
    {
        if ($enumValues === []) {
            return 'Answer with one of: todo / in_progress / done / blocked.';
        }

        $list = implode(' / ', $enumValues);

        return "Answer with one status from: {$list}.";
    }

    /**
     * @param  array<int, string>  $enumValues
     */
    private function tagsMultiPrompt(array $enumValues): string
    {
        if ($enumValues === []) {
            return 'Respond with multiple short labels separated by commas.';
        }

        $list = implode(' / ', $enumValues);

        return "Respond with multiple labels separated by commas. Allowed values: {$list}.";
    }
}
