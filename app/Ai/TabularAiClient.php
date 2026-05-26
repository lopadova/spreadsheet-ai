<?php

declare(strict_types=1);

namespace App\Ai;

use Illuminate\Support\Facades\Log;

use function Laravel\Ai\agent;

/**
 * Thin wrapper around the `laravel/ai` SDK so the rest of the codebase never
 * touches the SDK directly (single seam → trivial to fake / swap).
 *
 * `complete()` issues one text generation and returns the raw `->text`.
 *
 * NOTE: `prompt()` does not accept temperature / max_tokens — the SDK reads
 * those from the agent instance / provider config defaults. We rely on the
 * provider defaults (documented in docs/LESSON). Provider + model come from
 * `config('tabular.*')` so callers stay env()-free.
 *
 * SECURITY: any provider throwable is caught and re-thrown as {@see
 * AiException} with a GENERIC message. The real message is logged here, never
 * surfaced to callers / API consumers.
 */
class TabularAiClient
{
    public function complete(string $system, string $user): string
    {
        try {
            return agent($system)
                ->prompt(
                    $user,
                    provider: config('tabular.provider'),
                    model: config('tabular.model'),
                )
                ->text;
        } catch (\Throwable $e) {
            Log::warning('TabularAiClient provider call failed', [
                'message' => $e->getMessage(),
                'exception' => $e::class,
            ]);

            throw new AiException('AI provider error.', previous: $e);
        }
    }
}
