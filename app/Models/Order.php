<?php

namespace App\Models;

use Database\Factories\OrderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    /** @use HasFactory<OrderFactory> */
    use HasFactory;

    protected $fillable = [
        'code',
        'customer_id',
        'placed_at',
        'amount_cents',
        'ship_country',
        'ip',
        'device_fingerprint',
        'payment_method',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'placed_at' => 'datetime',
            'amount_cents' => 'integer',
        ];
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /** @return HasMany<OrderItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    /** @return HasMany<ReturnRow, $this> */
    public function returnRows(): HasMany
    {
        return $this->hasMany(ReturnRow::class);
    }
}
