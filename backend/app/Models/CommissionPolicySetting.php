<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommissionPolicySetting extends Model
{
    public $incrementing = false;

    protected $fillable = [
        'id',
        'current_rate_id',
    ];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'current_rate_id' => 'integer',
        ];
    }

    public function currentRate(): BelongsTo
    {
        return $this->belongsTo(CommissionRate::class, 'current_rate_id');
    }
}
