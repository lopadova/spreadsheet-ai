<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\TabularReview;

use App\Http\Controllers\Controller;
use App\Models\TabularCell;
use App\Models\TabularReview;
use App\Services\TabularReview\TabularReviewExtractor;
use App\Support\TabularReview\CellFlag;
use App\Support\TabularReview\CellStatus;
use App\Support\TabularReview\PresetData;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class StreamController extends Controller
{
    public function __construct(
        private readonly TabularReviewExtractor $extractor,
    ) {}

    /**
     * Stream cells row-by-row as Server-Sent Events.
     *
     * Query params:
     *  - cols=0,1   restrict to these column indexes
     *  - force=1    (accepted; mock always regenerates)
     */
    public function stream(Request $request, int $id): StreamedResponse
    {
        $review = TabularReview::query()->where('tenant_id', 'demo')->find($id);

        if ($review === null) {
            throw new NotFoundHttpException("Review [{$id}] not found.");
        }

        $columnIndexes = $this->parseCols($request->query('cols'));
        $preset = PresetData::preset((string) $review->preset_key) ?? [];
        $rows = array_values($preset['rows'] ?? []);
        $pacingMs = (int) config('tabular.sse_pacing_ms', 120);
        $mock = (bool) config('tabular.mock', true);

        return new StreamedResponse(function () use ($review, $rows, $columnIndexes, $pacingMs, $mock): void {
            $onCell = function (TabularCell $cell) use ($pacingMs, $mock): void {
                $this->emit('cell', [
                    'row_id' => $cell->row_id,
                    'column_index' => $cell->column_index,
                    'content' => $cell->content,
                    'flag' => $cell->flag,
                    'confidence' => $cell->confidence !== null ? (float) $cell->confidence : null,
                    'status' => $cell->status,
                ]);

                if ($mock && $pacingMs > 0) {
                    usleep($pacingMs * 1000);
                }
            };

            foreach ($rows as $rowIndex => $row) {
                $rowId = $this->extractor->rowId($row, $rowIndex);

                try {
                    $this->extractor->extractRow($review, $row, $rowIndex, $rowId, $onCell, $columnIndexes);
                } catch (\Throwable $e) {
                    // Never 500 mid-stream — emit a red cell for EVERY affected column
                    // so the client is never stuck waiting for a cell event that won't arrive.
                    Log::warning('StreamController row extraction threw', [
                        'review_id' => $review->id,
                        'row_id' => $rowId,
                        'exception' => $e::class,
                    ]);

                    $errorIndexes = $columnIndexes ?? array_keys(array_values($review->columns_config ?? []));
                    foreach ($errorIndexes ?: [0] as $colIdx) {
                        $this->emit('cell', [
                            'row_id' => $rowId,
                            'column_index' => $colIdx,
                            'content' => [
                                'summary' => null,
                                'flag' => CellFlag::RED->value,
                                'reasoning' => 'Row extraction failed.',
                                'citations' => [],
                            ],
                            'flag' => CellFlag::RED->value,
                            'confidence' => 0.20,
                            'status' => CellStatus::FAILED->value,
                        ]);
                    }
                }
            }

            $this->emit('done', ['review_id' => $review->id]);
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
            'Connection' => 'keep-alive',
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function emit(string $event, array $data): void
    {
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

        if ($json === false) {
            return; // Un-encodable payload — skip rather than corrupt the stream.
        }

        echo 'event: '.$event."\n";
        echo 'data: '.$json."\n\n";

        if (function_exists('ob_get_level') && ob_get_level() > 0) {
            @ob_flush();
        }
        flush();
    }

    /**
     * @return list<int>|null
     */
    private function parseCols(mixed $cols): ?array
    {
        if (! is_string($cols) || trim($cols) === '') {
            return null;
        }

        $out = [];
        foreach (explode(',', $cols) as $c) {
            $c = trim($c);
            if ($c !== '' && ctype_digit($c)) {
                $out[] = (int) $c;
            }
        }

        return $out === [] ? null : $out;
    }
}
