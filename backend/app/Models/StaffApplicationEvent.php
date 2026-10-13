<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffApplicationEvent extends Model
{
    protected $fillable = [
        'staff_profile_id', 'actor_id', 'event', 'from_status',
        'to_status', 'note', 'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function profile(): BelongsTo
    {
        return $this->belongsTo(StaffProfile::class, 'staff_profile_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}