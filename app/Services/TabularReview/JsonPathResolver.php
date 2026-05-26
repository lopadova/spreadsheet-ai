<?php

declare(strict_types=1);

namespace App\Services\TabularReview;

use Illuminate\Support\Facades\Log;

/**
 * Resolves a JSONPath-style key against a PHP array (the serialized row JSON).
 *
 * Ported from AskMyDocs (`TabularReviewExtractor::parseJsonPath/descend/
 * stringifyValue`). Accepts `$.a.b`, `a.b`, and `$['a']['b']`.
 *
 * Stringification rules:
 *  - booleans → "true" / "false" (PHP's `(string) false` is "", losing it),
 *  - other scalars cast normally,
 *  - arrays / objects → json_encode (null on failure),
 *  - missing path → null.
 */
class JsonPathResolver
{
    /**
     * Resolve `$path` against `$data`, returning the stringified value or
     * null when the path is missing / unencodable.
     *
     * @param  array<mixed>  $data
     */
    public function resolve(string $path, array $data): ?string
    {
        $segments = $this->parseJsonPath($path);

        if ($segments === []) {
            return null;
        }

        $value = $this->descend($data, $segments);

        if ($value === null) {
            return null;
        }

        return $this->stringifyValue($value);
    }

    /**
     * @return list<string>
     */
    public function parseJsonPath(string $path): array
    {
        // Accept `$.foo.bar`, `foo.bar`, `$['foo']['bar']` — strip the root
        // marker and bracket notation, then split on dots.
        $path = preg_replace('/^\\$\.?/', '', $path) ?? $path;
        $path = (string) preg_replace_callback(
            "/\\[\\s*['\"]?([^'\"\\]]+)['\"]?\\s*\\]/",
            static fn ($m) => '.'.$m[1],
            $path,
        );
        $path = trim($path, '.');

        if ($path === '') {
            return [];
        }

        return array_values(array_filter(
            explode('.', $path),
            static fn ($p) => $p !== '',
        ));
    }

    /**
     * @param  array<mixed>  $haystack
     * @param  list<string>  $segments
     */
    public function descend(array $haystack, array $segments): mixed
    {
        $current = $haystack;

        foreach ($segments as $segment) {
            if (! is_array($current) || ! array_key_exists($segment, $current)) {
                return null;
            }
            $current = $current[$segment];
        }

        return $current;
    }

    /**
     * Convert a JSON-path lookup result into a string. Booleans map to the
     * literal "true" / "false" tokens. Scalars cast normally. Arrays /
     * objects go through json_encode; encoding failure returns null so the
     * caller can fall through to the red-flag refusal path.
     */
    public function stringifyValue(mixed $value): ?string
    {
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if (is_scalar($value)) {
            return (string) $value;
        }

        try {
            return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
        } catch (\JsonException $e) {
            Log::warning('JsonPathResolver encode failed', ['message' => $e->getMessage()]);

            return null;
        }
    }
}
