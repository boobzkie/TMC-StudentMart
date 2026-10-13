<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderIdempotencyKey extends Model
{
    protected $fillable = [
        'buyer_id',
        'idempotency_key',
        'request_hash',
        'order_ids',
    ];

    protected function casts(): array
    {
        return [
            'order_ids' => 'array',
        ];
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }
}
