<?php

namespace Database\Factories;

use App\Models\EmailCampaign;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EmailCampaign>
 */
class EmailCampaignFactory extends Factory
{
    protected $model = EmailCampaign::class;

    public function definition(): array
    {
        return [
            'code' => 'C-'.fake()->unique()->numberBetween(100, 999),
            'name' => fake()->sentence(3),
            'sent_at' => fake()->dateTimeBetween('-1 month', 'now'),
            'open_rate' => fake()->randomFloat(1, 0, 60),
            'ctr_vs_baseline' => fake()->randomElement([null, '+18%', '-42%', '+71%']),
            'segment' => fake()->randomElement([null, 'VIP', 'Dormienti', 'New visitors']),
            'subject' => fake()->sentence(5),
        ];
    }
}
