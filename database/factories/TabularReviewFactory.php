<?php

namespace Database\Factories;

use App\Models\TabularReview;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TabularReview>
 */
class TabularReviewFactory extends Factory
{
    protected $model = TabularReview::class;

    public function definition(): array
    {
        return [
            'tenant_id' => 'demo',
            'preset_key' => fake()->randomElement(['returns', 'fraud', 'articles', 'email', 'formats']),
            'title' => fake()->sentence(3),
            'row_source' => fake()->randomElement(['returns_rows', 'orders', 'articles', 'email_campaigns']),
            'columns_config' => [
                ['index' => 0, 'name' => 'Sample', 'prompt' => 'Sample prompt', 'format' => 'text'],
            ],
        ];
    }
}
