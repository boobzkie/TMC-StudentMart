<?php

namespace App\Http\Controllers;

use App\Models\CommissionRate;
use App\Models\Order;
use App\Models\OrderCommission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminCommissionController extends Controller
{
    public function index(): JsonResponse
    {
        $completedOrders = Order::query()
            ->where('status', 'completed')
            ->with(['seller:id,name,student_id', 'commission.collector:id,name'])
            ->orderByDesc('completed_at')
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        $ledger = OrderCommission::query();
        $totalEarned = (float) (clone $ledger)->whereIn('status', ['uncollected', 'collected'])->sum('commission_amount');
        $totalCollected = (float) (clone $ledger)->where('status', 'collected')->sum('commission_amount');
        $totalUncollected = (float) (clone $ledger)->where('status', 'uncollected')->sum('commission_amount');
        $unconfiguredCount = (clone $ledger)->where('status', 'unconfigured')->count()
            + Order::query()->where('status', 'completed')->whereDoesntHave('commission')->count();

        $latestRate = CommissionRate::query()
            ->where('effective_at', '<=', now())
            ->orderByDesc('effective_at')
            ->orderByDesc('id')
            ->first();
        $currentRate = $latestRate && ! $latestRate->is_deactivation
            ? $latestRate
            : null;

        $rates = CommissionRate::query()
            ->with('configuredBy:id,name')
            ->orderByDesc('effective_at')
            ->orderByDesc('id')
            ->limit(100)
            ->get()
            ->map(fn (CommissionRate $rate): array => [
                'id' => $rate->id,
                'rate_percent' => $rate->rate_percent,
                'effective_at' => $rate->effective_at?->toIso8601String(),
                'configured_by' => $rate->configuredBy?->name,
                'is_deactivation' => $rate->is_deactivation,
            ])
            ->values();

        return response()->json([
            'success' => true,
            'current_rate' => $currentRate ? [
                'id' => $currentRate->id,
                'rate_percent' => $currentRate->rate_percent,
                'effective_at' => $currentRate->effective_at?->toIso8601String(),
            ] : null,
            'summary' => [
                'total_earned' => number_format($totalEarned, 2, '.', ''),
                'total_collected' => number_format($totalCollected, 2, '.', ''),
                'total_uncollected' => number_format($totalUncollected, 2, '.', ''),
                'unconfigured_orders' => $unconfiguredCount,
                'completed_orders' => Order::query()->where('status', 'completed')->count(),
            ],
            'rates' => $rates,
            'records' => $completedOrders->map(function (Order $order): array {
                $commission = $order->commission;

                return [
                    'id' => $commission?->id,
                    'order_id' => $order->id,
                    'order_number' => $order->order_number,
                    'seller' => $order->seller?->name ?? $order->seller_name_snapshot,
                    'completed_at' => $order->completed_at?->toIso8601String(),
                    'sale_amount' => $commission?->sale_amount ?? $order->total_amount,
                    'rate_percent' => $commission?->rate_percent,
                    'commission_amount' => $commission?->commission_amount,
                    'status' => $commission?->status ?? 'historical_unrated',
                    'earned_at' => $commission?->earned_at?->toIso8601String(),
                    'collected_at' => $commission?->collected_at?->toIso8601String(),
                    'collector' => $commission?->collector?->name,
                    'collection_reference' => $commission?->collection_reference,
                    'collection_note' => $commission?->collection_note,
                ];
            })->values(),
            'tax' => [
                'status' => 'unconfigured',
                'message' => 'No tax amount is calculated because an approved tax rule has not been configured.',
            ],
        ]);
    }

    public function storeRate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rate_percent' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        $rate = DB::transaction(function () use ($request, $validated): CommissionRate {
            $currentRate = CommissionRate::query()
                ->where('effective_at', '<=', now())
                ->orderByDesc('effective_at')
                ->orderByDesc('id')
                ->lockForUpdate()
                ->first();

            $ratePercent = number_format((float) $validated['rate_percent'], 4, '.', '');

            if ($currentRate && ! $currentRate->is_deactivation && (float) $currentRate->rate_percent === (float) $ratePercent) {
                throw ValidationException::withMessages([
                    'rate_percent' => ['This commission rate is already active.'],
                ]);
            }

            return CommissionRate::query()->create([
                'rate_percent' => $ratePercent,
                'is_deactivation' => false,
                'effective_at' => now(),
                'configured_by' => $request->user()->id,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'A new commission rate is active. Earlier order rates remain unchanged.',
            'rate' => [
                'id' => $rate->id,
                'rate_percent' => $rate->rate_percent,
                'effective_at' => $rate->effective_at?->toIso8601String(),
            ],
        ], 201);
    }

    public function updateRate(Request $request, CommissionRate $commissionRate): JsonResponse
    {
        $validated = $request->validate([
            'rate_percent' => ['required', 'numeric', 'min:0', 'max:100'],
        ]);

        $rate = DB::transaction(function () use ($request, $validated, $commissionRate): CommissionRate {
            $latestRate = CommissionRate::query()
                ->where('effective_at', '<=', now())
                ->orderByDesc('effective_at')
                ->orderByDesc('id')
                ->lockForUpdate()
                ->first();

            if (! $latestRate || $latestRate->is_deactivation || $latestRate->id !== $commissionRate->id) {
                throw ValidationException::withMessages([
                    'rate' => ['Only the current active rate can be updated. Refresh the page and try again.'],
                ]);
            }

            $ratePercent = number_format((float) $validated['rate_percent'], 4, '.', '');
            if ((float) $latestRate->rate_percent === (float) $ratePercent) {
                throw ValidationException::withMessages([
                    'rate_percent' => ['This commission rate is already active.'],
                ]);
            }

            return CommissionRate::query()->create([
                'rate_percent' => $ratePercent,
                'is_deactivation' => false,
                'effective_at' => now(),
                'configured_by' => $request->user()->id,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Commission rate updated for future completed orders. Earlier rate history and order snapshots remain unchanged.',
            'rate' => [
                'id' => $rate->id,
                'rate_percent' => $rate->rate_percent,
                'effective_at' => $rate->effective_at?->toIso8601String(),
                'is_deactivation' => $rate->is_deactivation,
            ],
        ], 201);
    }

    public function deactivateRate(Request $request, CommissionRate $commissionRate): JsonResponse
    {
        $deactivation = DB::transaction(function () use ($request, $commissionRate): CommissionRate {
            $latestRate = CommissionRate::query()
                ->where('effective_at', '<=', now())
                ->orderByDesc('effective_at')
                ->orderByDesc('id')
                ->lockForUpdate()
                ->first();

            if (! $latestRate || $latestRate->is_deactivation || $latestRate->id !== $commissionRate->id) {
                throw ValidationException::withMessages([
                    'rate' => ['Only the current active rate can be deactivated. Refresh the page and try again.'],
                ]);
            }

            return CommissionRate::query()->create([
                'rate_percent' => '0.0000',
                'is_deactivation' => true,
                'effective_at' => now(),
                'configured_by' => $request->user()->id,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Commission rate deactivated for future completed orders. Earlier rate history and order snapshots remain unchanged.',
            'rate' => [
                'id' => $deactivation->id,
                'rate_percent' => $deactivation->rate_percent,
                'effective_at' => $deactivation->effective_at?->toIso8601String(),
                'is_deactivation' => $deactivation->is_deactivation,
            ],
        ], 201);
    }

    public function collect(Request $request, OrderCommission $orderCommission): JsonResponse
    {
        $validated = $request->validate([
            'confirmed' => ['required', 'accepted'],
            'collection_reference' => ['nullable', 'string', 'max:120'],
            'collection_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $commission = DB::transaction(function () use ($request, $orderCommission, $validated): OrderCommission {
            $lockedCommission = OrderCommission::query()
                ->whereKey($orderCommission->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedCommission->status !== 'uncollected' || (float) $lockedCommission->commission_amount <= 0) {
                throw ValidationException::withMessages([
                    'commission' => ['Only a positive, uncollected commission can be marked as collected.'],
                ]);
            }

            $lockedCommission->status = 'collected';
            $lockedCommission->collected_at = now();
            $lockedCommission->collected_by = $request->user()->id;
            $lockedCommission->collection_reference = $validated['collection_reference'] ?? null;
            $lockedCommission->collection_note = $validated['collection_note'] ?? null;
            $lockedCommission->save();

            return $lockedCommission->load('collector:id,name');
        });

        return response()->json([
            'success' => true,
            'message' => 'Commission collection was recorded.',
            'commission' => [
                'id' => $commission->id,
                'status' => $commission->status,
                'collected_at' => $commission->collected_at?->toIso8601String(),
                'collector' => $commission->collector?->name,
                'collection_reference' => $commission->collection_reference,
            ],
        ]);
    }
}
