<?php

namespace Tests\Feature;

use App\Models\TabularCell;
use App\Models\TabularReview;
use App\Models\Workflow;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TabularModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_tabular_review_columns_config_round_trips_as_array(): void
    {
        $config = [
            ['index' => 0, 'name' => 'Risk', 'prompt' => 'Score it', 'format' => 'rating'],
            ['index' => 1, 'name' => 'Conf', 'prompt' => '$.a.b', 'format' => 'percentage', 'json_path' => '$.a.b'],
        ];

        $review = TabularReview::factory()->create(['columns_config' => $config]);

        $this->assertSame($config, $review->fresh()->columns_config);
        $this->assertIsArray($review->fresh()->columns_config);
    }

    public function test_tabular_cell_content_round_trips_as_array(): void
    {
        $content = [
            'summary' => 'A summary',
            'flag' => 'green',
            'reasoning' => 'because',
            'citations' => ['c1', 'c2'],
        ];

        $cell = TabularCell::factory()->create([
            'content' => $content,
            'confidence' => 0.9,
        ]);

        $fresh = $cell->fresh();
        $this->assertSame($content, $fresh->content);
        $this->assertIsArray($fresh->content);
        $this->assertIsFloat($fresh->confidence);
        $this->assertSame(0.9, $fresh->confidence);
    }

    public function test_duplicate_cell_coordinates_throw(): void
    {
        $review = TabularReview::factory()->create();

        TabularCell::factory()->create([
            'review_id' => $review->id,
            'row_id' => '42',
            'column_index' => 3,
        ]);

        $this->expectException(QueryException::class);

        TabularCell::factory()->create([
            'review_id' => $review->id,
            'row_id' => '42',
            'column_index' => 3,
        ]);
    }

    public function test_duplicate_workflow_tenant_preset_throws(): void
    {
        Workflow::factory()->create(['tenant_id' => 'demo', 'preset_key' => 'returns']);

        $this->expectException(QueryException::class);

        Workflow::factory()->create(['tenant_id' => 'demo', 'preset_key' => 'returns']);
    }

    public function test_workflows_with_null_preset_key_do_not_collide(): void
    {
        Workflow::factory()->create(['tenant_id' => 'demo', 'preset_key' => null]);
        Workflow::factory()->create(['tenant_id' => 'demo', 'preset_key' => null]);

        $this->assertSame(2, Workflow::query()->whereNull('preset_key')->count());
    }
}
