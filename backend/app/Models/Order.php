<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Order extends Model
{
    protected $fillable = [
        'order_number',
        'buyer_id',
        'seller_id',
        'buyer_name_snapshot',
        'seller_name_snapshot',
        'status',
        'seller_response_deadline_at',
        'needs_attention',
        'total_amount',
        'payment_method_id',
        'payment_method_name_snapshot',
        'payment_method_instructions_snapshot',
        'pickup_location_id',
        'pickup_location_name_snapshot',
        'pickup_location_area_snapshot',
        'pickup_location_details_snapshot',
        'pickup_location_instructions_snapshot',
        'pickup_location_hours_snapshot',
        'buyer_note',
        'seller_note',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'seller_response_deadline_at' => 'datetime',
            'needs_attention' => 'boolean',
            'completed_at' => 'datetime',
        ];
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_id');
    }

    public function seller(): BelongsTo
    {
        return $this->belongsTo(User::class, 'seller_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(OrderPaymentMethod::class, 'payment_method_id');
    }

    public function pickupLocation(): BelongsTo
    {
        return $this->belongsTo(PickupLocation::class);
    }

    public function commission(): HasOne
    {
        return $this->hasOne(OrderCommission::class);
    }
}
