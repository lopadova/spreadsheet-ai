<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Order;
use App\Models\ReturnRow;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ReturnRow>
 */
class ReturnRowFactory extends Factory
{
    protected $model = ReturnRow::class;

    public function definition(): array
    {
        return [
            'code' => 'RET-'.fake()->unique()->numberBetween(1000, 9999),
            'order_id' => Order::factory(),
            'customer_id' => Customer::factory(),
            'returned_at' => fake()->dateTimeBetween('-1 month', 'now'),
            'amount_cents' => fake()->numberBetween(1_000, 300_000),
            'declared_reason' => fake()->sentence(),
            'status' => fake()->randomElement(['pending', 'done', 'blocked', 'in_progress']),
        ];
    }
}
