<?php

namespace App\Http\Controllers;

use App\Models\CommissionPolicySetting;
use App\Models\CommissionRate;
use App\Models\Order;
use App\Models\OrderCommission;
use App\Models\TaxConfiguration;
use App\Models\TaxConfigurationHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminCommissionController extends Controller
{
    private const DEMO_TAX_NAME = 'StudentMart Demo Tax';

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

        $settings = CommissionPolicySetting::query()
            ->with('currentRate.configuredBy:id,name')
            ->find(1);
        $currentRate = $settings?->currentRate;
        if ($currentRate?->is_deactivation) {
            $currentRate = null;
        }

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
                'configured_by' => $rate->configured_by_name ?: $rate->configuredBy?->name,
                'is_deactivation' => $rate->is_deactivation,
                'is_active' => $currentRate?->id === $rate->id,
            ])
            ->values();

        $taxConfiguration = TaxConfiguration::query()->with('configuredBy:id,name')->find(1);
        $taxHistory = TaxConfigurationHistory::query()
            ->with('changedBy:id,name')
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn (TaxConfigurationHistory $entry): array => [
                'id' => $entry->id,
                'action' => $entry->action,
                'previous_rate_percent' => $entry->previous_rate_percent,
                'rate_percent' => $entry->rate_percent,
                'previous_is_active' => $entry->previous_is_active,
                'is_active' => $entry->is_active,
                'changed_by' => $entry->changed_by_name ?: $entry->changedBy?->name,
                'changed_at' => $entry->created_at?->toIso8601String(),
            ])
            ->values();

        $paidDemoTaxOrders = Order::query()
            ->where('payment_status', 'paid')
            ->where('tax_enabled', true);
        $totalDemoTaxCollected = (float) (clone $paidDemoTaxOrders)->sum('tax_amount');
        $demoTaxByDate = (clone $paidDemoTaxOrders)
            ->selectRaw('DATE(created_at) as order_date, SUM(tax_amount) as tax_amount, COUNT(*) as order_count')
            ->groupByRaw('DATE(created_at)')
            ->orderByDesc('order_date')
            ->limit(14)
            ->get()
            ->map(fn (object $row): array => [
                'date' => $row->order_date,
                'tax_amount' => number_format((float) $row->tax_amount, 2, '.', ''),
                'order_count' => (int) $row->order_count,
            ])
            ->values();
        $recentTaxOrders = Order::query()
            ->with(['buyer:id,name', 'seller:id,name'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(12)
            ->get()
            ->map(fn (Order $order): array => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'buyer' => $order->buyer?->name ?? $order->buyer_name_snapshot,
                'seller' => $order->seller?->name ?? $order->seller_name_snapshot,
                'created_at' => $order->created_at?->toIso8601String(),
                'product_subtotal' => $order->product_subtotal ?? $order->total_amount,
                'tax_name' => $order->tax_name,
                'tax_enabled' => (bool) $order->tax_enabled,
                'tax_rate_percent' => $order->tax_rate_percent,
                'tax_amount' => $order->tax_amount ?? '0.00',
                'total_amount' => $order->total_amount,
                'payment_status' => $order->payment_status,
            ])
            ->values();

        return response()->json([
            'success' => true,
            'current_rate' => $currentRate ? [
                'id' => $currentRate->id,
                'rate_percent' => $currentRate->rate_percent,
                'effective_at' => $currentRate->effective_at?->toIso8601String(),
                'configured_by' => $currentRate->configured_by_name ?: $currentRate->configuredBy?->name,
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
                    'seller_earnings' => $commission?->sellerEarningsAmount(),
                    'status' => $commission?->status ?? 'historical_unrated',
                    'earned_at' => $commission?->earned_at?->toIso8601String(),
                    'collected_at' => $commission?->collected_at?->toIso8601String(),
                    'collector' => $commission?->collector?->name,
                    'collection_reference' => $commission?->collection_reference,
                    'collection_note' => $commission?->collection_note,
                ];
            })->values(),
            'tax' => [
                'name' => self::DEMO_TAX_NAME,
                'status' => $taxConfiguration === null || $taxConfiguration->rate_percent === null
                    ? 'unconfigured'
                    : ($taxConfiguration->is_active ? 'active' : 'inactive'),
                'rate_percent' => $taxConfiguration?->rate_percent,
                'is_active' => (bool) $taxConfiguration?->is_active,
                'configured_by' => $taxConfiguration?->configured_by_name ?: $taxConfiguration?->configuredBy?->name,
                'updated_at' => $taxConfiguration?->updated_at?->toIso8601String(),
                'message' => 'This is an internal academic demonstration only. It is not government tax or a tax compliance calculation.',
            ],
            'tax_history' => $taxHistory,
            'tax_summary' => [
                'total_demo_tax_collected' => number_format($totalDemoTaxCollected, 2, '.', ''),
                'collected_order_count' => (clone $paidDemoTaxOrders)->count(),
                'by_date' => $demoTaxByDate,
                'recent_orders' => $recentTaxOrders,
            ],
        ]);
    }

    public function storeRate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rate_percent' => ['required', 'numeric', 'decimal:0,4', 'min:0', 'max:100'],
        ]);

        $rate = DB::transaction(function () use ($request, $validated): CommissionRate {
            $settings = CommissionPolicySetting::query()->whereKey(1)->lockForUpdate()->firstOrFail();

            $ratePercent = number_format((float) $validated['rate_percent'], 4, '.', '');

            if ($settings->current_rate_id !== null) {
                throw ValidationException::withMessages([
                    'rate' => ['A commission rate is already active. Update or deactivate it instead of creating another rate.'],
                ]);
            }

            $rate = CommissionRate::query()->create([
                'rate_percent' => $ratePercent,
                'is_deactivation' => false,
                'effective_at' => now(),
                'configured_by' => $request->user()->id,
                'configured_by_name' => $request->user()->name,
            ]);
            $settings->current_rate_id = $rate->id;
            $settings->save();

            return $rate;
        });

        return response()->json([
            'success' => true,
            'message' => 'The commission rate is active for future eligible orders. Earlier order snapshots remain unchanged.',
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
            'rate_percent' => ['required', 'numeric', 'decimal:0,4', 'min:0', 'max:100'],
        ]);

        $rate = DB::transaction(function () use ($request, $validated, $commissionRate): CommissionRate {
            $settings = CommissionPolicySetting::query()->whereKey(1)->lockForUpdate()->firstOrFail();
            $currentRate = CommissionRate::query()
                ->whereKey($settings->current_rate_id)
                ->lockForUpdate()
                ->first();

            if (! $currentRate || $currentRate->is_deactivation || (int) $currentRate->id !== (int) $commissionRate->id) {
                throw ValidationException::withMessages([
                    'rate' => ['Only the active rate can be updated. Refresh the page and try again.'],
                ]);
            }

            $ratePercent = number_format((float) $validated['rate_percent'], 4, '.', '');
            if ((float) $currentRate->rate_percent === (float) $ratePercent) {
                throw ValidationException::withMessages([
                    'rate_percent' => ['This commission rate is already active.'],
                ]);
            }

            $rate = CommissionRate::query()->create([
                'rate_percent' => $ratePercent,
                'is_deactivation' => false,
                'effective_at' => now(),
                'configured_by' => $request->user()->id,
                'configured_by_name' => $request->user()->name,
            ]);
            $settings->current_rate_id = $rate->id;
            $settings->save();

            return $rate;
        });

        return response()->json([
            'success' => true,
            'message' => 'Commission rate updated for future eligible orders. Earlier rate history and order snapshots remain unchanged.',
            'rate' => [
                'id' => $rate->id,
                'rate_percent' => $rate->rate_percent,
                'effective_at' => $rate->effective_at?->toIso8601String(),
                'configured_by' => $rate->configured_by_name,
            ],
        ], 201);
    }

    public function deactivateRate(Request $request, CommissionRate $commissionRate): JsonResponse
    {
        $deactivation = DB::transaction(function () use ($request, $commissionRate): CommissionRate {
            $settings = CommissionPolicySetting::query()->whereKey(1)->lockForUpdate()->firstOrFail();
            $currentRate = CommissionRate::query()
                ->whereKey($settings->current_rate_id)
                ->lockForUpdate()
                ->first();

            if (! $currentRate || $currentRate->is_deactivation || (int) $currentRate->id !== (int) $commissionRate->id) {
                throw ValidationException::withMessages([
                    'rate' => ['Only the active rate can be deactivated. Refresh the page and try again.'],
                ]);
            }

            $deactivation = CommissionRate::query()->create([
                'rate_percent' => '0.0000',
                'is_deactivation' => true,
                'effective_at' => now(),
                'configured_by' => $request->user()->id,
                'configured_by_name' => $request->user()->name,
            ]);
            $settings->current_rate_id = null;
            $settings->save();

            return $deactivation;
        });

        return response()->json([
            'success' => true,
            'message' => 'Commission rate deactivated for future confirmed orders. Earlier rate history and order snapshots remain unchanged.',
            'rate' => [
                'id' => $deactivation->id,
                'rate_percent' => $deactivation->rate_percent,
                'effective_at' => $deactivation->effective_at?->toIso8601String(),
                'is_deactivation' => $deactivation->is_deactivation,
            ],
        ], 201);
    }

    public function updateTax(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rate_percent' => ['sometimes', 'required', 'numeric', 'decimal:0,4', 'min:0', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if ($validated === []) {
            throw ValidationException::withMessages([
                'settings' => ['Provide a demo tax rate or activation status to save.'],
            ]);
        }

        $result = DB::transaction(function () use ($request, $validated): array {
            $configuration = TaxConfiguration::query()->whereKey(1)->lockForUpdate()->firstOrFail();
            $currentRate = $configuration->rate_percent;
            if (! array_key_exists('rate_percent', $validated) && $currentRate === null) {
                throw ValidationException::withMessages([
                    'rate_percent' => ['Set a demo tax rate before changing its activation status.'],
                ]);
            }
            $ratePercent = array_key_exists('rate_percent', $validated)
                ? number_format((float) $validated['rate_percent'], 4, '.', '')
                : (string) $currentRate;
            $isActive = array_key_exists('is_active', $validated)
                ? (bool) $validated['is_active']
                : (bool) $configuration->is_active;
            $rateChanged = $currentRate === null || (float) $currentRate !== (float) $ratePercent;
            $statusChanged = (bool) $configuration->is_active !== $isActive;

            if (! $rateChanged && ! $statusChanged) {
                return [
                    'configuration' => $configuration,
                    'changed' => false,
                ];
            }

            $previousRate = $configuration->rate_percent;
            $previousIsActive = $configuration->is_active;
            $action = $previousRate === null
                ? 'configured'
                : ($rateChanged
                    ? 'updated'
                    : ($isActive ? 'activated' : 'deactivated'));

            $configuration->rate_percent = $ratePercent;
            $configuration->is_active = $isActive;
            $configuration->configured_by = $request->user()->id;
            $configuration->configured_by_name = $request->user()->name;
            $configuration->save();

            TaxConfigurationHistory::query()->create([
                'previous_rate_percent' => $previousRate,
                'rate_percent' => $configuration->rate_percent,
                'previous_is_active' => $previousIsActive,
                'is_active' => $isActive,
                'action' => $action,
                'changed_by' => $request->user()->id,
                'changed_by_name' => $request->user()->name,
            ]);

            return [
                'configuration' => $configuration,
                'changed' => true,
            ];
        });
        /** @var TaxConfiguration $configuration */
        $configuration = $result['configuration'];
        $status = $configuration->is_active ? 'active' : 'inactive';

        return response()->json([
            'success' => true,
            'message' => $result['changed']
                ? 'StudentMart Demo Tax settings were saved. The new configuration applies only to future orders.'
                : 'StudentMart Demo Tax settings were unchanged.',
            'tax' => [
                'name' => self::DEMO_TAX_NAME,
                'status' => $status,
                'rate_percent' => $configuration->rate_percent,
                'is_active' => (bool) $configuration->is_active,
                'configured_by' => $configuration->configured_by_name,
                'updated_at' => $configuration->updated_at?->toIso8601String(),
            ],
        ]);
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
