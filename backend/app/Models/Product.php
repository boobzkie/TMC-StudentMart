<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'category_id',
        'name',
        'description',
        'price',
        'category',
        'image',
        'status',
        'attributes',
        'stock_quantity',
        'sold_out_at',
        'archived_at',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'attributes' => 'array',
        'stock_quantity' => 'integer',
        'sold_out_at' => 'datetime',
        'archived_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function categoryRecord(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)->orderBy('id');
    }

    public function complaints(): HasMany
    {
        return $this->hasMany(Complaint::class, 'product_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(ProductReview::class);
    }

    public function moderationEvents(): HasMany
    {
        return $this->hasMany(ProductModerationEvent::class)->latest('created_at');
    }

    public function warnings(): HasMany
    {
        return $this->hasMany(ProductWarning::class)->latest('created_at');
    }

    public function latestModerationEvent(): HasOne
    {
        return $this->hasOne(ProductModerationEvent::class)->latestOfMany();
    }

    public function historyEvents(): HasMany
    {
        return $this->hasMany(ProductHistoryEvent::class)->latest('created_at');
    }
}
