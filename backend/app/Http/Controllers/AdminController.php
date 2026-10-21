<?php

namespace App\Http\Controllers;

// @stats-extension: marketplace overview metrics

use App\Models\Product;
use App\Models\User;
use App\Models\Complaint;
use App\Models\Order;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    private const COURSES = ['BSIT', 'BSOA', 'BSCRIM', 'BSED', 'CAS'];
    private const LOW_STOCK_THRESHOLD = 5;

    public function stats(Request $request): JsonResponse
    {
        $period = $request->query('period', '30d');
        if (!in_array($period, ['today', '7d', '30d', '90d', '12m'], true)) {
            $period = '30d';
        }
        $totalUsers = User::count();
        $totalStudents = User::where('role', 'student')->count();
        $totalAdmins = User::where('role', 'admin')->count();
        $totalStaff = User::query()->where('role', 'staff')->where('status', '!=', 'archived')->count();
        $pendingStaffApplications = User::query()
            ->where('role', 'staff')
            ->where('status', 'pending')
            ->count();
        $courseCounts = User::query()
            ->where('role', 'student')
            ->whereIn('course', self::COURSES)
            ->select('course', DB::raw('COUNT(*) as total'))
            ->groupBy('course')
            ->pluck('total', 'course');

        $totalProducts = Product::count();
        $pendingProducts = Product::where('status', 'pending')->count();
        $approvedProducts = Product::where('status', 'active')->count();
        $rejectedProducts = Product::where('status', 'rejected')->count();
        $inactiveProducts = Product::where('status', 'inactive')->count();
        $suspendedProducts = Product::where('status', 'suspended')->count();
        $soldOutProducts = Product::where('status', 'sold_out')->count();
        $archivedProducts = Product::where('status', 'archived')->count();
        $newProducts = Product::where('created_at', '>=', now()->subDays(7))->count();

        $totalOrders = Order::count();
        $newOrders = Order::where('status', 'pending')->count();
        $processingOrders = Order::where('status', 'confirmed')->count();
        $readyForPickupOrders = Order::where('status', 'ready_for_pickup')->count();
        $completedOrders = Order::where('status', 'completed')->count();
        $declinedOrders = Order::where('status', 'declined')->count();
        $cancelledOrders = Order::where('status', 'cancelled')->count();

        $pendingPayments = Order::where('payment_status', 'pending')
            ->whereNotIn('status', ['cancelled', 'declined'])
            ->count();
        $paidOrders = Order::where('payment_status', 'paid')->count();

        $lowStockProducts = Product::where('status', '!=', 'archived')
            ->where('stock_quantity', '>', 0)
            ->where('stock_quantity', '<=', self::LOW_STOCK_THRESHOLD)
            ->count();
        $outOfStockProducts = Product::where('status', '!=', 'archived')
            ->where('stock_quantity', '<=', 0)
            ->count();

        $openComplaints = Complaint::where('status', 'open')->count();
        $underReviewComplaints = Complaint::where('status', 'under_review')->count();

        $unverifiedAccounts = User::whereNull('email_verified_at')->where('status', 'active')->count();
        $suspendedAccounts = User::where('status', 'suspended')->count();
        $recentlyRegisteredUsers = User::where('created_at', '>=', now()->subDays(30))->count();
        $activeSellers = User::query()->where('role', 'student')
            ->whereHas('products', fn ($query) => $query->where('status', '!=', 'archived'))
            ->distinct()
            ->count();

        $recentActivity = $this->recentActivity();
        $ordersOverTime = $this->ordersOverTime($period);

        return response()->json([
            'success' => true,
            'stats' => [
                'total_users' => $totalUsers,
                'total_students' => $totalStudents,
                'total_admins' => $totalAdmins,
                'total_staff' => $totalStaff,
                'pending_staff_applications' => $pendingStaffApplications,
                'course_stats' => collect(self::COURSES)->mapWithKeys(fn ($course) => [$course => (int) ($courseCounts[$course] ?? 0)])->all(),
                'total_products' => $totalProducts,
                'pending_products' => $pendingProducts,
                'approved_products' => $approvedProducts,
                'active_products' => $approvedProducts,
                'rejected_products' => $rejectedProducts,
                'inactive_products' => $inactiveProducts,
                'suspended_products' => $suspendedProducts,
                'sold_out_products' => $soldOutProducts,
                'archived_products' => $archivedProducts,
                'new_products' => $newProducts,
                'total_orders' => $totalOrders,
                'pending_orders' => $newOrders,
                'new_orders' => $newOrders,
                'processing_orders' => $processingOrders,
                'ready_for_pickup_orders' => $readyForPickupOrders,
                'completed_orders' => $completedOrders,
                'declined_orders' => $declinedOrders,
                'cancelled_orders' => $cancelledOrders,
                'pending_payments' => $pendingPayments,
                'paid_orders' => $paidOrders,
                'low_stock_products' => $lowStockProducts,
                'out_of_stock_products' => $outOfStockProducts,
                'open_complaints' => $openComplaints,
                'under_review_complaints' => $underReviewComplaints,
                'unverified_accounts' => $unverifiedAccounts,
                'suspended_accounts' => $suspendedAccounts,
                'recently_registered_users' => $recentlyRegisteredUsers,
                'active_sellers' => $activeSellers,
                'recent_activity' => $recentActivity,
                'orders_over_time' => $ordersOverTime,
                'orders_over_time_period' => $period,
            ],
        ]);
    }

    private function ordersOverTime(string $period): array
    {
        $now = now();
        if ($period === 'today') {
            $start = $now->copy()->startOfDay();
            $frequency = 'day';
        } elseif ($period === '7d') {
            $start = $now->copy()->startOfDay()->subDays(6);
            $frequency = 'day';
        } elseif ($period === '90d') {
            $start = $now->copy()->startOfDay()->subDays(89)->startOfWeek(Carbon::MONDAY);
            $frequency = 'week';
        } elseif ($period === '12m') {
            $start = $now->copy()->startOfMonth()->subMonths(11);
            $frequency = 'month';
        } else {
            $start = $now->copy()->startOfDay()->subDays(29);
            $frequency = 'day';
        }

        $dailyCounts = Order::query()
            ->whereBetween('created_at', [$start, $now])
            ->selectRaw('DATE(created_at) as order_date, COUNT(*) as total')
            ->groupBy('order_date')
            ->pluck('total', 'order_date');

        $countsByBucket = [];
        foreach ($dailyCounts as $date => $total) {
            $day = Carbon::parse((string) $date);
            $key = match ($frequency) {
                'week' => $day->startOfWeek(Carbon::MONDAY)->toDateString(),
                'month' => $day->format('Y-m'),
                default => $day->toDateString(),
            };
            $countsByBucket[$key] = ($countsByBucket[$key] ?? 0) + (int) $total;
        }

        $bucketEnd = match ($frequency) {
            'week' => $now->copy()->startOfWeek(Carbon::MONDAY),
            'month' => $now->copy()->startOfMonth(),
            default => $now->copy()->startOfDay(),
        };
        $cursor = $start->copy();
        $series = [];

        while ($cursor <= $bucketEnd) {
            $key = match ($frequency) {
                'week' => $cursor->toDateString(),
                'month' => $cursor->format('Y-m'),
                default => $cursor->toDateString(),
            };
            $series[] = [
                'key' => $key,
                'label' => match ($frequency) {
                    'week' => $cursor->format('M j'),
                    'month' => $cursor->format('M Y'),
                    default => $cursor->format('M j'),
                },
                'orders' => (int) ($countsByBucket[$key] ?? 0),
            ];

            match ($frequency) {
                'week' => $cursor->addWeek(),
                'month' => $cursor->addMonth(),
                default => $cursor->addDay(),
            };
        }

        return $series;
    }

    private function recentActivity(): array
    {
        $activities = [];

        $recentUsers = User::query()->latest('created_at')->limit(5)->get(['id', 'name', 'email', 'role', 'status', 'created_at']);
        foreach ($recentUsers as $user) {
            $activities[] = [
                'user' => $user->name,
                'action' => ucfirst(str_replace('_', ' ', $user->role)) . ' account registered',
                'date_time' => $user->created_at?->toIso8601String(),
                'status' => $user->status,
                'type' => 'user',
            ];
        }

        $recentProducts = Product::query()->latest('created_at')->limit(5)->get(['id', 'name', 'status', 'created_at']);
        foreach ($recentProducts as $product) {
            $activities[] = [
                'user' => $product->user?->name ?? 'Seller',
                'action' => 'Listing submitted: ' . $product->name,
                'date_time' => $product->created_at?->toIso8601String(),
                'status' => $product->status,
                'type' => 'product',
            ];
        }

        $recentOrders = Order::query()->latest('created_at')->limit(5)->get(['id', 'order_number', 'status', 'created_at']);
        foreach ($recentOrders as $order) {
            $activities[] = [
                'user' => $order->buyer?->name ?? 'Buyer',
                'action' => 'Order ' . $order->order_number . ' placed',
                'date_time' => $order->created_at?->toIso8601String(),
                'status' => $order->status,
                'type' => 'order',
            ];
        }

        usort($activities, fn ($a, $b) => strtotime($b['date_time'] ?? '1970-01-01') <=> strtotime($a['date_time'] ?? '1970-01-01'));

        return array_slice($activities, 0, 10);
    }
}
