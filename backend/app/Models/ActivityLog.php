<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ActivityLog extends Model
{
    protected $fillable = [
        'event_type',
        'action',
        'actor_id',
        'actor_name',
        'actor_role',
        'subject_type',
        'subject_id',
        'target',
        'status',
        'details',
        'source_type',
        'source_id',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'details' => 'array',
            'occurred_at' => 'datetime',
        ];
    }
}
