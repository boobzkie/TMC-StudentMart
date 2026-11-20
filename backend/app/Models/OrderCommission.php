<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderCommission extends Model
{
    protected $fillable = [
        'order_id',
        'commission_rate_id',
        'sale_amount',
        'rate_percent',
        'commission_amount',
        'status',
        'earned_at',
        'collected_at',
        'collected_by',
        'collection_reference',
        'collection_note',
    ];

    protected function casts(): array
    {
        return [
            'sale_amount' => 'decimal:2',
            'rate_percent' => 'decimal:4',
            'commission_amount' => 'decimal:2',
            'earned_at' => 'datetime',
            'collected_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function rate(): BelongsTo
    {
        return $this->belongsTo(CommissionRate::class, 'commission_rate_id');
    }

    public function collector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'collected_by');
    }

    public function sellerEarningsAmount(): ?string
    {
        if ($this->sale_amount === null || $this->commission_amount === null) {
            return null;
        }

        $saleCents = $this->moneyToCents((string) $this->sale_amount);
        $commissionCents = $this->moneyToCents((string) $this->commission_amount);
        $earningsCents = $saleCents - $commissionCents;

        return intdiv($earningsCents, 100).'.'.str_pad((string) ($earningsCents % 100), 2, '0', STR_PAD_LEFT);
    }

    private function moneyToCents(string $amount): int
    {
        if (! preg_match('/^(\d+)(?:\.(\d{1,2}))?$/', $amount, $matches)) {
            throw new \LogicException('Cannot calculate seller earnings from an invalid saved amount.');
        }

        return ((int) $matches[1] * 100) + (int) str_pad($matches[2] ?? '', 2, '0');
    }
}
