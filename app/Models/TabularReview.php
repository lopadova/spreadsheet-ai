<?php

namespace App\Models;

use Database\Factories\TabularReviewFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TabularReview extends Model
{
    /** @use HasFactory<TabularReviewFactory> */
    use HasFactory;

    protected $fillable = [
        'tenant_id',
        'preset_key',
        'title',
        'row_source',
        'columns_config',
    ];

    protected function casts(): array
    {
        return [
            'columns_config' => 'array',
        ];
    }

    /** @return HasMany<TabularCell, $this> */
    public function cells(): HasMany
    {
        return $this->hasMany(TabularCell::class, 'review_id');
    }
}
