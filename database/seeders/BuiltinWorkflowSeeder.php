<?php

namespace Database\Seeders;

use App\Models\Workflow;
use App\Support\TabularReview\PresetData;
use Illuminate\Database\Seeder;

/**
 * Inserts one system workflow per preset (is_system = true), mapping each
 * preset's ai_cols to columns_config (index, name, prompt, format,
 * enum_values, json_path). Includes the 16-format showcase preset.
 */
class BuiltinWorkflowSeeder extends Seeder
{
    public function run(): void
    {
        foreach (PresetData::presets() as $key => $preset) {
            Workflow::query()->updateOrCreate(
                ['tenant_id' => 'demo', 'preset_key' => $key],
                [
                    'title' => $preset['label'],
                    'description' => $preset['description'],
                    'row_source' => $preset['row_source'],
                    'columns_config' => PresetData::columnsConfig($preset),
                    'is_system' => true,
                ]
            );
        }
    }
}
