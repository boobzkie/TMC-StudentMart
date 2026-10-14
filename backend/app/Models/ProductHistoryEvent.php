<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductHistoryEvent extends Model
{
    protected $fillable = [
        'actor_id',
        'order_id',
        'product_variant_id',
        'variant_label_snapshot',
        'variant_attributes_snapshot',
        'event',
        'stock_before',
        'stock_after',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'stock_before' => 'integer',
            'stock_after' => 'integer',
            'variant_attributes_snapshot' => 'array',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function variant(): BelongsTo
    {
        return $this->belongsTo(ProductVariant::class, 'product_variant_id');
    }
}
