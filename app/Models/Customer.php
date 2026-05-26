<?php

namespace App\Models;

use Database\Factories\CustomerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    /** @use HasFactory<CustomerFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'email',
        'total_orders',
        'returns_12mo',
        'loyalty_tier',
        'ltv_cents',
    ];

    protected function casts(): array
    {
        return [
            'total_orders' => 'integer',
            'returns_12mo' => 'integer',
            'ltv_cents' => 'integer',
        ];
    }

    /** @return HasMany<Order, $this> */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /** @return HasMany<ReturnRow, $this> */
    public function returnRows(): HasMany
    {
        return $this->hasMany(ReturnRow::class);
    }
}
