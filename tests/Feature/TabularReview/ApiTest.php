<?php

declare(strict_types=1);

namespace Tests\Feature\TabularReview;

use App\Models\TabularReview;
use App\Support\TabularReview\PresetData;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['tabular.mock' => true]);
    }

    public function test_get_review_returns_full_shape(): void
    {
        $res = $this->getJson('/api/reviews/returns');

        $res->assertOk()
            ->assertJsonStructure([
                'review' => ['id', 'preset_key', 'title', 'row_source'],
                'base_columns',
                'columns',
                'rows' => [['row_id']],
                'cells',
                'suggestions_available',
            ]);

        $this->assertSame('returns', $res->json('review.preset_key'));
        $this->assertSame('RET-1042', $res->json('rows.0.row_id'));
        $this->assertTrue($res->json('suggestions_available'));
    }

    public function test_get_review_is_idempotent_find_or_create(): void
    {
        $this->getJson('/api/reviews/returns')->assertOk();
        $this->getJson('/api/reviews/returns')->assertOk();

        $this->assertSame(1, TabularReview::query()->where('preset_key', 'returns')->count());
    }

    public function test_unknown_preset_is_404(): void
    {
        $this->getJson('/api/reviews/nope')->assertNotFound();
    }

    public function test_suggest_returns_cooked_proposals(): void
    {
        $res = $this->getJson('/api/suggest/returns');

        $res->assertOk();
        $this->assertCount(count(PresetData::suggestions()['returns']), $res->json('suggestions'));
        $this->assertSame('Probabilità chargeback 30gg', $res->json('suggestions.0.name'));
    }

    public function test_add_column_appends(): void
    {
        $id = $this->getJson('/api/reviews/returns')->json('review.id');
        $before = count($this->getJson('/api/reviews/returns')->json('columns'));

        $res = $this->postJson("/api/reviews/{$id}/columns", [
            'name' => 'New col',
            'format' => 'text',
            'prompt' => 'do something',
        ]);

        $res->assertCreated();
        $this->assertCount($before + 1, $res->json('columns'));
    }

    public function test_add_column_rejects_bad_format(): void
    {
        $id = $this->getJson('/api/reviews/returns')->json('review.id');

        $this->postJson("/api/reviews/{$id}/columns", [
            'name' => 'Bad',
            'format' => 'not_a_format',
        ])->assertStatus(422)->assertJsonValidationErrorFor('format');
    }

    public function test_add_enum_column_requires_enum_values(): void
    {
        $id = $this->getJson('/api/reviews/returns')->json('review.id');

        $this->postJson("/api/reviews/{$id}/columns", [
            'name' => 'Enum',
            'format' => 'enum',
        ])->assertStatus(422)->assertJsonValidationErrorFor('enum_values');
    }

    public function test_add_json_path_column_requires_json_path(): void
    {
        $id = $this->getJson('/api/reviews/returns')->json('review.id');

        $this->postJson("/api/reviews/{$id}/columns", [
            'name' => 'JP',
            'format' => 'json_path',
        ])->assertStatus(422)->assertJsonValidationErrorFor('json_path');
    }

    public function test_edit_column_clears_its_cells(): void
    {
        $id = $this->getJson('/api/reviews/returns')->json('review.id');
        $review = TabularReview::query()->find($id);

        // Seed a cell on column 0.
        app(\App\Services\TabularReview\TabularReviewExtractor::class)
            ->extractRow($review, PresetData::preset('returns')['rows'][0], 0, 'RET-1042');
        $this->assertSame('ready', $review->cells()->where('column_index', 0)->first()->status);

        $this->patchJson("/api/reviews/{$id}/columns/0", [
            'name' => 'Edited',
            'format' => 'text',
            'prompt' => 'changed',
        ])->assertOk();

        $this->assertSame('pending', $review->cells()->where('column_index', 0)->first()->status);
    }

    public function test_edit_unknown_column_is_404(): void
    {
        $id = $this->getJson('/api/reviews/returns')->json('review.id');

        $this->patchJson("/api/reviews/{$id}/columns/999", [
            'name' => 'X',
            'format' => 'text',
        ])->assertNotFound();
    }

    public function test_delete_column_removes_it(): void
    {
        $id = $this->getJson('/api/reviews/returns')->json('review.id');
        $before = count($this->getJson('/api/reviews/returns')->json('columns'));

        $res = $this->deleteJson("/api/reviews/{$id}/columns/0");

        $res->assertOk();
        $this->assertCount($before - 1, $res->json('columns'));
    }
}
