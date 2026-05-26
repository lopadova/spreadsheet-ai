<?php

namespace Database\Factories;

use App\Models\Article;
use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderItem>
 */
class OrderItemFactory extends Factory
{
    protected $model = OrderItem::class;

    public function definition(): array
    {
        $price = fake()->numberBetween(1_000, 100_000);

        return [
            'order_id' => Order::factory(),
            'article_id' => Article::factory(),
            'qty' => fake()->numberBetween(1, 4),
            'unit_price_cents' => $price,
            'unit_cost_cents' => (int) round($price * 0.4),
        ];
    }
}
