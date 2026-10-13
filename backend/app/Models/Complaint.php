<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Complaint extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'product_id',
        'subject',
        'description',
        'status',
        'admin_response',
        'staff_note',
        'handled_by',
        'handled_at',
        'resolved_at',
    ];

    protected $casts = [
        'handled_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function handler(): BelongsTo
    {
        return $this->belongsTo(User::class, 'handled_by');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    public function isInReview(): bool
    {
        return $this->status === 'in_review';
    }

    public function isResolved(): bool
    {
        return $this->status === 'resolved';
    }

    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }
}