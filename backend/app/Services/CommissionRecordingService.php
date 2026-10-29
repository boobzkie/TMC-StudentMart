<?php

namespace App\Services;

use App\Models\CommissionRate;
use App\Models\Order;
use App\Models\OrderCommission;
use Carbon\CarbonInterface;

class CommissionRecordingService
{
    public function recordCompletedOrder(Order $order, CarbonInterface $completedAt): OrderCommission
    {
        $existing = OrderCommission::query()->where('order_id', $order->id)->first();

        if ($existing) {
            return $existing;
        }

        $rate = CommissionRate::query()
            ->where('effective_at', '<=', $completedAt)
            ->orderByDesc('effective_at')
            ->orderByDesc('id')
            ->lockForUpdate()
            ->first();

        if (! $rate) {
            return OrderCommission::query()->create([
                'order_id' => $order->id,
                'sale_amount' => $order->total_amount,
                'status' => 'unconfigured',
            ]);
        }

        $ratePercent = $rate->is_deactivation ? 0.0 : (float) $rate->rate_percent;
        $rateSnapshot = $rate->is_deactivation ? '0.0000' : $rate->rate_percent;
        $commissionAmount = number_format(round(((float) $order->total_amount * $ratePercent) / 100, 2), 2, '.', '');

        return OrderCommission::query()->create([
            'order_id' => $order->id,
            'commission_rate_id' => $rate->id,
            'sale_amount' => $order->total_amount,
            'rate_percent' => $rateSnapshot,
            'commission_amount' => $commissionAmount,
            'status' => $ratePercent > 0 ? 'uncollected' : 'not_due',
            'earned_at' => $completedAt,
        ]);
    }
}
