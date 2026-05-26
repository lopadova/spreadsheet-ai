<?php

namespace Tests\Unit;

use App\Support\TabularReview\PresetData;
use Tests\TestCase;

class PresetDataTest extends TestCase
{
    public function test_presets_returns_five_expected_keys(): void
    {
        $presets = PresetData::presets();

        $this->assertCount(5, $presets);
        $this->assertSame(
            ['returns', 'fraud', 'articles', 'email', 'formats'],
            array_keys($presets)
        );
    }

    public function test_each_preset_has_required_structure(): void
    {
        foreach (PresetData::presets() as $key => $preset) {
            $this->assertSame($key, $preset['key']);
            $this->assertArrayHasKey('row_source', $preset);
            $this->assertArrayHasKey('base_cols', $preset);
            $this->assertArrayHasKey('ai_cols', $preset);
            $this->assertArrayHasKey('rows', $preset);
            $this->assertArrayHasKey('cells', $preset);

            // Every ai_col must have a cooked cell list of equal length to rows.
            $rowCount = count($preset['rows']);
            foreach ($preset['ai_cols'] as $col) {
                $this->assertArrayHasKey($col['id'], $preset['cells'], "Missing cells for {$key}.{$col['id']}");
                $this->assertCount(
                    $rowCount,
                    $preset['cells'][$col['id']],
                    "Cell count mismatch for {$key}.{$col['id']}"
                );
            }
        }
    }

    public function test_formats_preset_exposes_sixteen_ai_columns(): void
    {
        $this->assertCount(16, PresetData::presets()['formats']['ai_cols']);
    }

    public function test_norm_cell_defaults(): void
    {
        $this->assertSame(
            ['value' => null, 'flag' => 'grey', 'citation' => null],
            PresetData::normCell(null)
        );

        $this->assertSame(
            ['value' => 'No', 'flag' => 'green', 'citation' => null],
            PresetData::normCell(['v' => 'No'])
        );

        $this->assertSame(
            ['value' => 'Yes', 'flag' => 'red', 'citation' => '11 resi'],
            PresetData::normCell(['v' => 'Yes', 'flag' => 'red', 'cit' => '11 resi'])
        );
    }

    public function test_columns_config_maps_json_path_and_enum(): void
    {
        $returns = PresetData::presets()['returns'];
        $config = PresetData::columnsConfig($returns);

        $this->assertCount(8, $config);

        $enumCol = collect($config)->firstWhere('name', 'Motivo semantico');
        $this->assertSame('enum', $enumCol['format']);
        $this->assertArrayHasKey('enum_values', $enumCol);

        $jsonCol = collect($config)->firstWhere('name', 'Confidence');
        $this->assertArrayHasKey('json_path', $jsonCol);
        $this->assertSame('$.action.confidence', $jsonCol['json_path']);
    }
}
