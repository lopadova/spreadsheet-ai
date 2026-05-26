<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Mock Mode
    |--------------------------------------------------------------------------
    |
    | When true, the Tabular Review engine returns the cooked preset cells
    | instead of calling a live LLM provider. This lets the demo run offline
    | and with zero API cost. Flip to false (and set an API key) for Live mode.
    |
    */

    'mock' => env('TABULAR_AI_MOCK', true),

    'provider' => env('TABULAR_AI_PROVIDER', 'anthropic'),
    'model' => env('TABULAR_AI_MODEL', 'claude-haiku-4-5'),

    'sse_pacing_ms' => env('TABULAR_SSE_PACING_MS', 120),

    'max_tokens' => 1200,
    'temperature' => 0.1,

];
