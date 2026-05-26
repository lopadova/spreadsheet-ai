<?php

namespace Database\Factories;

use App\Models\TabularCell;
use App\Models\TabularReview;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TabularCell>
 */
class TabularCellFactory extends Factory
{
    protected $model = TabularCell::class;

    public function definition(): array
    {
        return [
            'tenant_id' => 'demo',
            'review_id' => TabularReview::factory(),
            'row_id' => (string) fake()->numberBetween(1, 1000),
            'column_index' => fake()->numberBetween(0, 7),
            'content' => [
                'summary' => fake()->sentence(),
                'flag' => 'green',
                'reasoning' => fake()->sentence(),
                'citations' => [],
            ],
            'flag' => 'green',
            'status' => 'done',
            'confidence' => fake()->randomFloat(2, 0, 1),
            'generated_at' => now(),
        ];
    }
}
