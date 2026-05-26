<?php

namespace Database\Factories;

use App\Models\Customer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Customer>
 */
class CustomerFactory extends Factory
{
    protected $model = Customer::class;

    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'total_orders' => fake()->numberBetween(0, 50),
            'returns_12mo' => fake()->numberBetween(0, 12),
            'loyalty_tier' => fake()->randomElement([null, 'VIP-Gold', 'VIP-Silver', 'Bronze']),
            'ltv_cents' => fake()->numberBetween(0, 5_000_00),
        ];
    }
}
