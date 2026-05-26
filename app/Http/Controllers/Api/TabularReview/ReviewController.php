<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\TabularReview;

use App\Http\Controllers\Controller;
use App\Services\TabularReview\ReviewHydrator;
use App\Support\TabularReview\PresetData;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ReviewController extends Controller
{
    public function __construct(
        private readonly ReviewHydrator $hydrator,
    ) {}

    /**
     * Find-or-create the review for a preset and return the full payload.
     */
    public function show(string $preset): JsonResponse
    {
        $this->assertKnownPreset($preset);

        $review = $this->hydrator->findOrCreate($preset);

        return response()->json($this->hydrator->payload($review));
    }

    /**
     * Return the cooked AI-suggest proposals for a preset.
     */
    public function suggest(string $preset): JsonResponse
    {
        $this->assertKnownPreset($preset);

        return response()->json([
            'preset' => $preset,
            'suggestions' => PresetData::suggestions()[$preset] ?? [],
        ]);
    }

    private function assertKnownPreset(string $preset): void
    {
        if (! in_array($preset, PresetData::keys(), true)) {
            throw new NotFoundHttpException("Unknown preset [{$preset}].");
        }
    }
}
