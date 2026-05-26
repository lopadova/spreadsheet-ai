<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Order;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    protected $model = Order::class;

    public function definition(): array
    {
        return [
            'code' => 'ORD-'.fake()->unique()->numberBetween(10000, 99999),
            'customer_id' => Customer::factory(),
            'placed_at' => fake()->dateTimeBetween('-1 year', 'now'),
            'amount_cents' => fake()->numberBetween(1_000, 500_000),
            'ship_country' => fake()->randomElement(['IT', 'US', 'NG', 'RO', 'DE']),
            'ip' => fake()->ipv4(),
            'device_fingerprint' => fake()->sha256(),
            'payment_method' => fake()->randomElement(['card', 'paypal', 'klarna']),
            'status' => fake()->randomElement(['pending', 'done', 'blocked', 'in_progress']),
        ];
    }
}
