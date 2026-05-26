<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MigrationSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_nine_domain_tables_exist(): void
    {
        $tables = [
            'customers',
            'articles',
            'orders',
            'order_items',
            'returns_rows',
            'email_campaigns',
            'tabular_reviews',
            'tabular_cells',
            'workflows',
        ];

        foreach ($tables as $table) {
            $this->assertTrue(Schema::hasTable($table), "Missing table: {$table}");
        }
    }

    public function test_tabular_cells_has_expected_columns(): void
    {
        $columns = [
            'id', 'tenant_id', 'review_id', 'row_id', 'column_index',
            'content', 'flag', 'status', 'confidence', 'generated_at',
        ];

        foreach ($columns as $column) {
            $this->assertTrue(
                Schema::hasColumn('tabular_cells', $column),
                "Missing column tabular_cells.{$column}"
            );
        }
    }
}
