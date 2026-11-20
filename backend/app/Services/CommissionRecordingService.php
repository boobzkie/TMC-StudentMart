<?php

namespace App\Services;

use App\Models\CommissionRate;
use App\Models\Order;
use App\Models\OrderCommission;
use Carbon\CarbonInterface;
use LogicException;

class CommissionRecordingService
{
    public function snapshotConfirmedOrder(Order $order, CarbonInterface $confirmedAt): OrderCommission
    {
        $existing = OrderCommission::query()->where('order_id', $order->id)->first();

        if ($existing) {
            return $existing;
        }

        return $this->createSnapshot($order, $confirmedAt, false);
    }

    public function recordCompletedOrder(Order $order, CarbonInterface $completedAt): OrderCommission
    {
        $existing = OrderCommission::query()->where('order_id', $order->id)->first();

        if ($existing) {
            if ($existing->earned_at !== null || $existing->status === 'unconfigured') {
                return $existing;
            }

            $existing->status = $this->rateToTenThousandths((string) $existing->rate_percent) > 0
                ? 'uncollected'
                : 'not_due';
            $existing->earned_at = $completedAt;
            $existing->save();

            return $existing;
        }

        return $this->createSnapshot($order, $completedAt, true);
    }

    private function createSnapshot(Order $order, CarbonInterface $effectiveAt, bool $earned): OrderCommission
    {
        $saleAmount = $this->productSubtotal($order);

        $rate = CommissionRate::query()
            ->where('effective_at', '<=', $effectiveAt)
            ->orderByDesc('effective_at')
            ->orderByDesc('id')
            ->lockForUpdate()
            ->first();

        if (! $rate) {
            return OrderCommission::query()->create([
                'order_id' => $order->id,
                'sale_amount' => $saleAmount,
                'status' => 'unconfigured',
            ]);
        }

        $ratePercent = $rate->is_deactivation ? '0.0000' : (string) $rate->rate_percent;
        $rateSnapshot = $rate->is_deactivation ? '0.0000' : $rate->rate_percent;
        $commissionAmount = $this->formatMoney($this->commissionCents(
            $this->moneyToCents($saleAmount),
            $this->rateToTenThousandths((string) $ratePercent),
        ));
        $hasCommission = $this->rateToTenThousandths((string) $ratePercent) > 0;

        return OrderCommission::query()->create([
            'order_id' => $order->id,
            'commission_rate_id' => $rate->id,
            'sale_amount' => $saleAmount,
            'rate_percent' => $rateSnapshot,
            'commission_amount' => $commissionAmount,
            'status' => $earned ? ($hasCommission ? 'uncollected' : 'not_due') : 'pending',
            'earned_at' => $earned ? $effectiveAt : null,
        ]);
    }

    private function productSubtotal(Order $order): string
    {
        $lineTotals = $order->items()->pluck('line_total');
        if ($lineTotals->isEmpty()) {
            throw new LogicException('Cannot record order commission without saved order item totals.');
        }

        $subtotalCents = $lineTotals->sum(fn ($lineTotal): int => $this->moneyToCents((string) $lineTotal));

        return $this->formatMoney($subtotalCents);
    }

    private function moneyToCents(string $amount): int
    {
        if (! preg_match('/^(\d+)(?:\.(\d{1,2}))?$/', $amount, $matches)) {
            throw new LogicException('Cannot record order commission from an invalid saved amount.');
        }

        return ((int) $matches[1] * 100) + (int) str_pad($matches[2] ?? '', 2, '0');
    }

    private function rateToTenThousandths(string $rate): int
    {
        if (! preg_match('/^(\d+)(?:\.(\d{1,4}))?$/', $rate, $matches)) {
            throw new LogicException('Cannot record order commission from an invalid saved rate.');
        }

        return ((int) $matches[1] * 10_000) + (int) str_pad($matches[2] ?? '', 4, '0');
    }

    private function commissionCents(int $saleCents, int $rateTenThousandths): int
    {
        // Rate is stored in percent with four decimal places. Round to cents
        // using the existing half-up monetary behavior, without float math.
        return intdiv(($saleCents * $rateTenThousandths) + 500_000, 1_000_000);
    }

    private function formatMoney(int $cents): string
    {
        return intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
