<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\TabularReview;

use App\Http\Controllers\Controller;
use App\Http\Requests\TabularReview\ColumnRequest;
use App\Models\TabularCell;
use App\Models\TabularReview;
use App\Services\TabularReview\ReviewHydrator;
use App\Support\TabularReview\CellStatus;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ColumnController extends Controller
{
    public function __construct(
        private readonly ReviewHydrator $hydrator,
    ) {}

    /**
     * Append a new column. Its cells start pending (regenerate on demand).
     */
    public function store(ColumnRequest $request, int $id): JsonResponse
    {
        $review = $this->findReview($id);
        $columns = $this->columns($review);

        $newIndex = count($columns);
        $columns[] = $this->columnFromRequest($request, $newIndex);

        $this->saveColumns($review, $columns);
        // New column: no existing cells to clear.

        return response()->json($this->hydrator->payload($review->fresh()), 201);
    }

    /**
     * Edit an existing column. Clears that column's cells (set pending) so
     * they regenerate.
     */
    public function update(ColumnRequest $request, int $id, int $index): JsonResponse
    {
        $review = $this->findReview($id);
        $columns = $this->columns($review);

        if (! array_key_exists($index, $columns)) {
            throw new NotFoundHttpException("Column [{$index}] not found.");
        }

        $columns[$index] = $this->columnFromRequest($request, $index);

        $this->saveColumns($review, $columns);
        $this->clearColumnCells($review, $index);

        return response()->json($this->hydrator->payload($review->fresh()));
    }

    /**
     * Remove a column, reindex the remaining ones, and drop affected cells.
     */
    public function destroy(int $id, int $index): JsonResponse
    {
        $review = $this->findReview($id);
        $columns = $this->columns($review);

        if (! array_key_exists($index, $columns)) {
            throw new NotFoundHttpException("Column [{$index}] not found.");
        }

        // Removing a column shifts everything after it — simplest correct
        // behaviour for the demo is to clear all cells and let the client
        // regenerate, since column_index values renumber.
        unset($columns[$index]);
        $columns = array_values($columns);
        foreach ($columns as $i => &$col) {
            $col['index'] = $i;
        }
        unset($col);

        $this->saveColumns($review, $columns);
        TabularCell::query()->where('review_id', $review->id)->delete();

        return response()->json($this->hydrator->payload($review->fresh()));
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function columns(TabularReview $review): array
    {
        return array_values($review->columns_config ?? []);
    }

    /**
     * @return array<string, mixed>
     */
    private function columnFromRequest(ColumnRequest $request, int $index): array
    {
        $col = [
            'index' => $index,
            'name' => (string) $request->input('name'),
            'prompt' => (string) ($request->input('prompt') ?? ''),
            'format' => (string) $request->input('format'),
        ];

        $enumValues = $request->input('enum_values');
        if (is_array($enumValues) && $enumValues !== []) {
            $col['enum_values'] = array_values($enumValues);
        }

        $jsonPath = $request->input('json_path');
        if (is_string($jsonPath) && trim($jsonPath) !== '') {
            $col['json_path'] = trim($jsonPath);
        }

        return $col;
    }

    /**
     * @param  list<array<string, mixed>>  $columns
     */
    private function saveColumns(TabularReview $review, array $columns): void
    {
        $review->columns_config = $columns;
        $review->save();
    }

    private function clearColumnCells(TabularReview $review, int $columnIndex): void
    {
        TabularCell::query()
            ->where('review_id', $review->id)
            ->where('column_index', $columnIndex)
            ->update([
                'content' => null,
                'flag' => null,
                'confidence' => null,
                'status' => CellStatus::PENDING->value,
                'generated_at' => null,
            ]);
    }

    private function findReview(int $id): TabularReview
    {
        $review = TabularReview::query()->where('tenant_id', 'demo')->find($id);

        if ($review === null) {
            throw new NotFoundHttpException("Review [{$id}] not found.");
        }

        return $review;
    }
}
