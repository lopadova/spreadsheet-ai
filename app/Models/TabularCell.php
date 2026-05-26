<?php

namespace App\Models;

use Database\Factories\TabularCellFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TabularCell extends Model
{
    /** @use HasFactory<TabularCellFactory> */
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'review_id',
        'row_id',
        'column_index',
        'content',
        'flag',
        'status',
        'confidence',
        'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'content' => 'array',
            'column_index' => 'integer',
            'confidence' => 'float',
            'generated_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<TabularReview, $this> */
    public function review(): BelongsTo
    {
        return $this->belongsTo(TabularReview::class, 'review_id');
    }
}
