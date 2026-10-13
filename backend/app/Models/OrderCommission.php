<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderCommission extends Model
{
    protected $fillable = [
        'order_id',
        'commission_rate_id',
        'sale_amount',
        'rate_percent',
        'commission_amount',
        'status',
        'earned_at',
        'collected_at',
        'collected_by',
        'collection_reference',
        'collection_note',
    ];

    protected function casts(): array
    {
        return [
            'sale_amount' => 'decimal:2',
            'rate_percent' => 'decimal:4',
            'commission_amount' => 'decimal:2',
            'earned_at' => 'datetime',
            'collected_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function rate(): BelongsTo
    {
        return $this->belongsTo(CommissionRate::class, 'commission_rate_id');
    }

    public function collector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'collected_by');
    }
}
