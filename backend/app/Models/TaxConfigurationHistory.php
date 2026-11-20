<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaxConfigurationHistory extends Model
{
    protected $table = 'tax_configuration_history';

    protected $fillable = [
        'previous_rate_percent',
        'rate_percent',
        'previous_is_active',
        'is_active',
        'action',
        'changed_by',
        'changed_by_name',
    ];

    protected function casts(): array
    {
        return [
            'previous_rate_percent' => 'decimal:4',
            'rate_percent' => 'decimal:4',
            'previous_is_active' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function changedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
