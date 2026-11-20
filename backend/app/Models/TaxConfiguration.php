<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaxConfiguration extends Model
{
    public $incrementing = false;

    protected $fillable = [
        'id',
        'rate_percent',
        'is_active',
        'configured_by',
        'configured_by_name',
    ];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'rate_percent' => 'decimal:4',
            'is_active' => 'boolean',
        ];
    }

    public function configuredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'configured_by');
    }
}
