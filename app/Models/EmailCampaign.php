<?php

namespace App\Models;

use Database\Factories\EmailCampaignFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmailCampaign extends Model
{
    /** @use HasFactory<EmailCampaignFactory> */
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'sent_at',
        'open_rate',
        'ctr_vs_baseline',
        'segment',
        'subject',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'open_rate' => 'float',
        ];
    }
}
