<?php

namespace Database\Factories;

use App\Models\Article;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Article>
 */
class ArticleFactory extends Factory
{
    protected $model = Article::class;

    public function definition(): array
    {
        $price = fake()->numberBetween(2_000, 200_000);

        return [
            'sku' => 'ART-'.fake()->unique()->numberBetween(1000, 9999),
            'name' => fake()->words(3, true),
            'brand' => fake()->randomElement([null, 'Liu Jo', 'Veja', 'Furla', 'Replay']),
            'price_cents' => $price,
            'cost_cents' => (int) round($price * 0.4),
            'description_it' => fake()->optional()->sentence(),
            'description_en' => fake()->optional()->sentence(),
            'has_alt_text' => fake()->boolean(80),
            'season' => fake()->randomElement([null, 'SS26', 'FW25']),
        ];
    }
}
