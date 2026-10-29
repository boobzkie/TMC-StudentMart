<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountEnforcementEvent extends Model
{
    protected $fillable = [
        'user_id',
        'actor_id',
        'action',
        'reason',
        'duration_days',
        'suspended_until',
    ];

    protected function casts(): array
    {
        return [
            'duration_days' => 'integer',
            'suspended_until' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
