<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CommissionRate extends Model
{
    protected $fillable = [
        'rate_percent',
        'effective_at',
        'configured_by',
    ];

    protected function casts(): array
    {
        return [
            'rate_percent' => 'decimal:4',
            'effective_at' => 'datetime',
        ];
    }

    public function configuredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'configured_by');
    }

    public function orderCommissions(): HasMany
    {
        return $this->hasMany(OrderCommission::class);
    }
}
