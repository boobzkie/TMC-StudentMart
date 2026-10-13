<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StaffProfile extends Model
{
    protected $fillable = [
        'user_id', 'first_name', 'middle_name', 'last_name', 'suffix',
        'date_of_birth', 'employee_id', 'department', 'position',
        'employment_status', 'employment_start_date', 'campus',
        'verification_document_path', 'application_reference_hash',
        'permissions', 'is_admin_created', 'reviewed_by', 'reviewed_at',
        'decision_reason', 'archived_at',
    ];

    protected $hidden = [
        'verification_document_path',
        'application_reference_hash',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'employment_start_date' => 'date',
            'last_seen_at' => 'datetime',
            'permissions' => 'array',
            'is_admin_created' => 'boolean',
            'reviewed_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function events(): HasMany
    {
        return $this->hasMany(StaffApplicationEvent::class)->latest();
    }

    public function hasPermission(string $permission): bool
    {
        return in_array($permission, $this->permissions ?? [], true);
    }
}