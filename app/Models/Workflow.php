<?php

namespace App\Models;

use Database\Factories\WorkflowFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Workflow extends Model
{
    /** @use HasFactory<WorkflowFactory> */
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'preset_key',
        'title',
        'description',
        'row_source',
        'columns_config',
        'is_system',
    ];

    protected function casts(): array
    {
        return [
            'columns_config' => 'array',
            'is_system' => 'boolean',
        ];
    }
}
