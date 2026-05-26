<?php

namespace App\Models;

use Database\Factories\ReturnRowFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReturnRow extends Model
{
    /** @use HasFactory<ReturnRowFactory> */
    use HasFactory;

    protected $table = 'returns_rows';

    protected $fillable = [
        'code',
        'order_id',
        'customer_id',
        'returned_at',
        'amount_cents',
        'declared_reason',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'returned_at' => 'datetime',
            'amount_cents' => 'integer',
        ];
    }

    /** @return BelongsTo<Order, $this> */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /** @return BelongsTo<Customer, $this> */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
