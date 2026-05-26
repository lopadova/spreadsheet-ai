<?php

namespace Database\Factories;

use App\Models\Workflow;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Workflow>
 */
class WorkflowFactory extends Factory
{
    protected $model = Workflow::class;

    public function definition(): array
    {
        return [
            'tenant_id' => 'demo',
            // Null by default so factory-made workflows never collide on the
            // unique (tenant_id, preset_key) index (NULLs are distinct).
            'preset_key' => null,
            'title' => fake()->sentence(3),
            'description' => fake()->optional()->sentence(),
            'row_source' => fake()->randomElement(['returns_rows', 'orders', 'articles', 'email_campaigns']),
            'columns_config' => [
                ['index' => 0, 'name' => 'Sample', 'prompt' => 'Sample prompt', 'format' => 'text'],
            ],
            'is_system' => false,
        ];
    }
}
