<?php

namespace App\Http\Controllers;

use App\Models\Complaint;
use App\Models\Order;
use App\Models\Product;
use App\Models\ProductModerationEvent;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    private const COURSES = ['BSIT', 'BSOA', 'BSCRIM', 'BSED', 'CAS'];
    private const LOW_STOCK_THRESHOLD = 5;
    private const VALID_ORDER_STATUSES = ['pending', 'confirmed', 'ready_for_pickup', 'completed'];
    private const CLOSED_ORDER_STATUSES = ['cancelled', 'declined'];

    public function stats(Request $request): JsonResponse
    {
        $period = $request->query('period', '30d');
        if (! in_array($period, ['today', '7d', '30d', '90d', '6m', '12m'], true)) {
            $period = '30d';
        }

        /*
        |--------------------------------------------------------------------------
        | Accounts
        |--------------------------------------------------------------------------
        */

        $userRoleCounts = User::query()
            ->selectRaw('role, COUNT(*) as total')
            ->groupBy('role')
            ->pluck('total', 'role');

        $totalUsers = (int) $userRoleCounts->sum();
        $totalStudents = (int) ($userRoleCounts['student'] ?? 0);
        $totalAdmins = (int) ($userRoleCounts['admin'] ?? 0);
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

        $studentStatusCounts = User::query()
            ->where('role', 'student')
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $activeStudents = (int) ($studentStatusCounts['active'] ?? 0);
        $suspendedStudents = (int) ($studentStatusCounts['suspended'] ?? 0);

        $unverifiedAccounts = User::query()
            ->whereNull('email_verified_at')
            ->where('status', 'active')
            ->count();
        $suspendedAccounts = User::query()->where('status', 'suspended')->count();
        $recentlyRegisteredUsers = User::query()->where('created_at', '>=', now()->subDays(30))->count();

        $studentSellers = User::query()
            ->where('role', 'student')
            ->whereHas('products')
            ->count();

        $studentsWithOrders = Order::query()
            ->whereHas('buyer', fn ($query) => $query->where('role', 'student'))
            ->distinct()
            ->count('buyer_id');

        $activeSellers = User::query()
            ->where('role', 'student')
            ->where('status', 'active')
            ->whereHas('products', fn ($query) => $query->where('status', 'active'))
            ->distinct()
            ->count();

        /*
        |--------------------------------------------------------------------------
        | Listings
        |--------------------------------------------------------------------------
        */

        $productStatusCounts = Product::query()
            ->selectRaw('LOWER(status) as status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $totalProducts = (int) $productStatusCounts->sum();
        $approvedProducts = (int) ($productStatusCounts['active'] ?? 0);
        $pendingProducts = (int) ($productStatusCounts['pending'] ?? 0);
        $rejectedProducts = (int) ($productStatusCounts['rejected'] ?? 0);
        $inactiveProducts = (int) ($productStatusCounts['inactive'] ?? 0);
        $suspendedProducts = (int) ($productStatusCounts['suspended'] ?? 0);
        $soldOutProducts = (int) ($productStatusCounts['sold_out'] ?? 0);
        $archivedProducts = (int) ($productStatusCounts['archived'] ?? 0);
        $newProducts = Product::query()->where('created_at', '>=', now()->subDays(7))->count();

        $lowStockProducts = Product::query()
            ->where('status', '!=', 'archived')
            ->where('stock_quantity', '>', 0)
            ->where('stock_quantity', '<=', self::LOW_STOCK_THRESHOLD)
            ->count();

        $outOfStockProducts = Product::query()
            ->where('status', '!=', 'archived')
            ->where('stock_quantity', '<=', 0)
            ->count();

        /*
        |--------------------------------------------------------------------------
        | Orders and sales
        |--------------------------------------------------------------------------
        */

        $orderStatusCounts = Order::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $totalOrders = (int) $orderStatusCounts->sum();
        $newOrders = (int) ($orderStatusCounts['pending'] ?? 0);
        $processingOrders = (int) ($orderStatusCounts['confirmed'] ?? 0);
        $readyForPickupOrders = (int) ($orderStatusCounts['ready_for_pickup'] ?? 0);
        $completedOrders = (int) ($orderStatusCounts['completed'] ?? 0);
        $declinedOrders = (int) ($orderStatusCounts['declined'] ?? 0);
        $cancelledOrders = (int) ($orderStatusCounts['cancelled'] ?? 0);

        $salesTotals = Order::query()
            ->selectRaw(
                "COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END), 0) as total_sales,
                 COALESCE(SUM(CASE WHEN status IN ('pending', 'confirmed', 'ready_for_pickup') THEN total_amount ELSE 0 END), 0) as pending_value"
            )
            ->first();

        $totalSales = round((float) ($salesTotals->total_sales ?? 0), 2);
        $pendingOrderValue = round((float) ($salesTotals->pending_value ?? 0), 2);
        $averageOrderValue = $completedOrders > 0
            ? round($totalSales / $completedOrders, 2)
            : 0.0;

        $totalItemsSold = (int) DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.status', 'completed')
            ->sum('order_items.quantity');

        /*
        |--------------------------------------------------------------------------
        | Payments
        |--------------------------------------------------------------------------
        */

        $paymentCounts = Order::query()
            ->whereNotIn('status', self::CLOSED_ORDER_STATUSES)
            ->selectRaw('payment_status, COUNT(*) as total, COALESCE(SUM(total_amount), 0) as amount')
            ->groupBy('payment_status')
            ->get();

        $paymentBreakdown = [
            'paid' => ['count' => 0, 'amount' => 0.0],
            'unpaid' => ['count' => 0, 'amount' => 0.0],
        ];
        foreach ($paymentCounts as $payment) {
            $key = ($payment->payment_status === 'paid') ? 'paid' : 'unpaid';
            $paymentBreakdown[$key]['count'] += (int) $payment->total;
            $paymentBreakdown[$key]['amount'] += (float) $payment->amount;
        }

        $pendingPayments = $paymentBreakdown['unpaid']['count'];
        $paidOrders = $paymentBreakdown['paid']['count'];

        /*
        |--------------------------------------------------------------------------
        | Complaints
        |--------------------------------------------------------------------------
        */

        $complaintCounts = Complaint::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $pendingComplaints = (int) ($complaintCounts['pending'] ?? 0);
        $underReviewComplaints = (int) ($complaintCounts['in_review'] ?? 0);
        $resolvedComplaints = (int) ($complaintCounts['resolved'] ?? 0);
        $rejectedComplaints = (int) ($complaintCounts['rejected'] ?? 0);
        $totalComplaints = (int) $complaintCounts->sum();
        $openComplaints = $pendingComplaints + $underReviewComplaints;

        /*
        |--------------------------------------------------------------------------
        | Time series
        |--------------------------------------------------------------------------
        */

        $ordersOverTime = $this->aggregateOverTime(Order::query(), $period, 'orders');
        $listingsOverTime = $this->aggregateOverTime(Product::query(), $period, 'listings');
        $studentsOverTime = $this->aggregateOverTime(
            User::query()->where('role', 'student'),
            $period,
            'students'
        );
        $complaintsOverTime = $this->aggregateOverTime(Complaint::query(), $period, 'complaints');

        $salesSeries = $this->aggregateOverTime(
            Order::query()->where('status', 'completed'),
            $period,
            'sales',
            'total_amount'
        );
        $pendingSeries = $this->aggregateOverTime(
            Order::query()->whereIn('status', ['pending', 'confirmed', 'ready_for_pickup']),
            $period,
            'pending',
            'total_amount'
        );
        $salesOrdersSeries = $this->aggregateOverTime(Order::query(), $period, 'orders');

        $pendingIndex = collect($pendingSeries)->keyBy('key');
        $salesOrderIndex = collect($salesOrdersSeries)->keyBy('key');
        $salesOverTime = array_map(function (array $point) use ($pendingIndex, $salesOrderIndex): array {
            return [
                'key' => $point['key'],
                'label' => $point['label'],
                'sales' => round((float) $point['sales'], 2),
                'pending' => round((float) ($pendingIndex[$point['key']]['pending'] ?? 0), 2),
                'orders' => (int) ($salesOrderIndex[$point['key']]['orders'] ?? 0),
            ];
        }, $salesSeries);

        /*
        |--------------------------------------------------------------------------
        | Category performance and top products
        |--------------------------------------------------------------------------
        */

        $categoryPerformance = $this->categoryPerformance();
        $topProducts = $this->topProducts();

        /*
        |--------------------------------------------------------------------------
        | Recent records for dashboard tables
        |--------------------------------------------------------------------------
        */

        $recentOrders = Order::query()
            ->with(['buyer:id,name', 'seller:id,name'])
            ->withCount('items')
            ->latest('created_at')
            ->limit(25)
            ->get()
            ->map(fn (Order $order): array => [
                'id' => (int) $order->id,
                'order_number' => (string) $order->order_number,
                'buyer' => $order->buyer?->name ?? $order->buyer_name_snapshot,
                'seller' => $order->seller?->name ?? $order->seller_name_snapshot,
                'item_count' => (int) ($order->items_count ?? 0),
                'total_amount' => (float) $order->total_amount,
                'payment_status' => (string) $order->payment_status,
                'payment_method' => (string) ($order->payment_method_name_snapshot ?? ''),
                'status' => (string) $order->status,
                'created_at' => $order->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        $recentListings = Product::query()
            ->with(['user:id,name', 'categoryRecord:id,name'])
            ->latest('created_at')
            ->limit(25)
            ->get()
            ->map(fn (Product $product): array => [
                'id' => (int) $product->id,
                'name' => (string) $product->name,
                'seller' => $product->user?->name ?? 'Removed seller',
                'category' => $product->categoryRecord?->name ?? $product->category ?? 'Uncategorized',
                'price' => (float) $product->price,
                'stock_quantity' => (int) $product->stock_quantity,
                'status' => (string) $product->status,
                'created_at' => $product->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        $recentUsers = User::query()
            ->latest('created_at')
            ->limit(25)
            ->get(['id', 'name', 'role', 'email', 'status', 'created_at'])
            ->map(fn (User $user): array => [
                'id' => (int) $user->id,
                'name' => (string) $user->name,
                'role' => (string) $user->role,
                'email' => (string) $user->email,
                'status' => (string) $user->status,
                'created_at' => $user->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        $recentComplaints = Complaint::query()
            ->with(['user:id,name', 'product:id,name'])
            ->latest('created_at')
            ->limit(25)
            ->get()
            ->map(fn (Complaint $complaint): array => [
                'id' => (int) $complaint->id,
                'subject' => (string) $complaint->subject,
                'reporter' => $complaint->user?->name ?? 'Removed student',
                'product' => $complaint->product?->name ?? 'General complaint',
                'status' => (string) $complaint->status,
                'created_at' => $complaint->created_at?->toIso8601String(),
            ])
            ->values()
            ->all();

        $recentActivity = $this->recentActivity();

        return response()->json([
            'success' => true,
            'stats' => [
                'total_users' => $totalUsers,
                'total_students' => $totalStudents,
                'total_admins' => $totalAdmins,
                'total_staff' => $totalStaff,
                'active_students' => $activeStudents,
                'suspended_students' => $suspendedStudents,
                'student_sellers' => $studentSellers,
                'students_with_orders' => $studentsWithOrders,
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
                'total_sales' => $totalSales,
                'completed_sales' => $totalSales,
                'pending_order_value' => $pendingOrderValue,
                'average_order_value' => $averageOrderValue,
                'total_items_sold' => $totalItemsSold,
                'pending_payments' => $pendingPayments,
                'paid_orders' => $paidOrders,
                'payment_breakdown' => $paymentBreakdown,
                'low_stock_products' => $lowStockProducts,
                'out_of_stock_products' => $outOfStockProducts,
                'total_complaints' => $totalComplaints,
                'open_complaints' => $openComplaints,
                'pending_complaints' => $pendingComplaints,
                'under_review_complaints' => $underReviewComplaints,
                'resolved_complaints' => $resolvedComplaints,
                'rejected_complaints' => $rejectedComplaints,
                'unverified_accounts' => $unverifiedAccounts,
                'suspended_accounts' => $suspendedAccounts,
                'recently_registered_users' => $recentlyRegisteredUsers,
                'active_sellers' => $activeSellers,
                'recent_activity' => $recentActivity,
                'orders_over_time' => $ordersOverTime,
                'listings_over_time' => $listingsOverTime,
                'students_over_time' => $studentsOverTime,
                'complaints_over_time' => $complaintsOverTime,
                'sales_over_time' => $salesOverTime,
                'category_performance' => $categoryPerformance,
                'top_products' => $topProducts,
                'recent_orders' => $recentOrders,
                'recent_listings' => $recentListings,
                'recent_users' => $recentUsers,
                'recent_complaints' => $recentComplaints,
                'orders_over_time_period' => $period,
            ],
        ]);
    }

    /**
     * Build an empty-filled time series for the selected dashboard range.
     */
    private function aggregateOverTime(
        Builder $records,
        string $period,
        string $valueKey,
        ?string $sumColumn = null
    ): array {
        [$start, $end, $frequency] = $this->periodRange($period);

        $aggregate = $sumColumn
            ? "COALESCE(SUM({$sumColumn}), 0) as total"
            : 'COUNT(*) as total';

        $dailyCounts = $records
            ->whereRaw('created_at BETWEEN ? AND ?', [$start, $end])
            ->selectRaw("DATE(created_at) as bucket_date, {$aggregate}")
            ->groupBy('bucket_date')
            ->pluck('total', 'bucket_date');

        $countsByBucket = [];
        foreach ($dailyCounts as $date => $total) {
            $key = $this->bucketKey(Carbon::parse((string) $date), $frequency);
            $countsByBucket[$key] = ($countsByBucket[$key] ?? 0) + (float) $total;
        }

        $cursor = $start->copy();
        if ($frequency === 'week') {
            $cursor->startOfWeek(Carbon::MONDAY);
        } elseif ($frequency === 'month') {
            $cursor->startOfMonth();
        }

        $bucketEnd = $end->copy();
        if ($frequency === 'week') {
            $bucketEnd->startOfWeek(Carbon::MONDAY);
        } elseif ($frequency === 'month') {
            $bucketEnd->startOfMonth();
        }

        $series = [];
        while ($cursor <= $bucketEnd) {
            $key = $this->bucketKey($cursor, $frequency);
            $value = (float) ($countsByBucket[$key] ?? 0);

            $series[] = [
                'key' => $key,
                'label' => $this->bucketLabel($cursor, $frequency),
                $valueKey => $sumColumn ? round($value, 2) : (int) $value,
            ];

            match ($frequency) {
                'week' => $cursor->addWeek(),
                'month' => $cursor->addMonth(),
                default => $cursor->addDay(),
            };
        }

        return $series;
    }

    private function periodRange(string $period): array
    {
        $now = now();

        return match ($period) {
            'today' => [$now->copy()->startOfDay(), $now->copy(), 'day'],
            '7d' => [$now->copy()->startOfDay()->subDays(6), $now->copy(), 'day'],
            '90d' => [$now->copy()->startOfDay()->subDays(89), $now->copy(), 'week'],
            '6m' => [$now->copy()->startOfMonth()->subMonths(5), $now->copy(), 'month'],
            '12m' => [$now->copy()->startOfMonth()->subMonths(11), $now->copy(), 'month'],
            default => [$now->copy()->startOfDay()->subDays(29), $now->copy(), 'day'],
        };
    }

    private function bucketKey(Carbon $date, string $frequency): string
    {
        return match ($frequency) {
            'week' => $date->copy()->startOfWeek(Carbon::MONDAY)->toDateString(),
            'month' => $date->format('Y-m'),
            default => $date->toDateString(),
        };
    }

    private function bucketLabel(Carbon $date, string $frequency): string
    {
        return match ($frequency) {
            'week' => $date->format('M j'),
            'month' => $date->format('M Y'),
            default => $date->format('M j'),
        };
    }

    /**
     * Listings, orders and sales grouped by category.
     */
    private function categoryPerformance(): array
    {
        $listingCounts = DB::table('categories')
            ->leftJoin('products', function ($join): void {
                $join->on('products.category_id', '=', 'categories.id')
                    ->orWhere(function ($query): void {
                        $query->whereNull('products.category_id')
                            ->whereColumn('products.category', 'categories.name');
                    });
            })
            ->selectRaw(
                "categories.id,
                 categories.name,
                 SUM(CASE WHEN LOWER(products.status) = 'active' THEN 1 ELSE 0 END) as active_listings,
                 SUM(CASE WHEN LOWER(products.status) = 'archived' THEN 1 ELSE 0 END) as archived_listings,
                 SUM(CASE WHEN LOWER(products.status) = 'pending' THEN 1 ELSE 0 END) as pending_listings,
                 SUM(CASE WHEN LOWER(products.status) = 'sold_out' THEN 1 ELSE 0 END) as sold_out_listings"
            )
            ->groupBy('categories.id', 'categories.name')
            ->get();

        $sales = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->leftJoin('categories', function ($join): void {
                $join->on('categories.id', '=', 'products.category_id')
                    ->orWhere(function ($query): void {
                        $query->whereNull('products.category_id')
                            ->whereColumn('categories.name', 'products.category');
                    });
            })
            ->where('orders.status', 'completed')
            ->whereNotNull('categories.id')
            ->selectRaw(
                'categories.id as category_id,
                 SUM(order_items.quantity) as items_sold,
                 COALESCE(SUM(order_items.line_total), 0) as sales'
            )
            ->groupBy('categories.id')
            ->get()
            ->keyBy('category_id');

        $orders = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->leftJoin('categories', function ($join): void {
                $join->on('categories.id', '=', 'products.category_id')
                    ->orWhere(function ($query): void {
                        $query->whereNull('products.category_id')
                            ->whereColumn('categories.name', 'products.category');
                    });
            })
            ->whereIn('orders.status', self::VALID_ORDER_STATUSES)
            ->whereNotNull('categories.id')
            ->selectRaw('categories.id as category_id, COUNT(DISTINCT orders.id) as orders')
            ->groupBy('categories.id')
            ->pluck('orders', 'category_id');

        return $listingCounts
            ->map(function ($row) use ($sales, $orders): array {
                $sale = $sales->get($row->id);

                return [
                    'id' => (int) $row->id,
                    'name' => (string) $row->name,
                    'active_listings' => (int) $row->active_listings,
                    'archived_listings' => (int) $row->archived_listings,
                    'pending_listings' => (int) $row->pending_listings,
                    'sold_out_listings' => (int) $row->sold_out_listings,
                    'orders' => (int) ($orders[$row->id] ?? 0),
                    'items_sold' => (int) ($sale->items_sold ?? 0),
                    'sales' => round((float) ($sale->sales ?? 0), 2),
                ];
            })
            ->filter(fn (array $row): bool => (
                $row['active_listings'] > 0
                || $row['archived_listings'] > 0
                || $row['pending_listings'] > 0
                || $row['orders'] > 0
                || $row['sales'] > 0
            ))
            ->sortByDesc('active_listings')
            ->values()
            ->all();
    }

    /**
     * Completed product rankings for the dashboard.
     */
    private function topProducts(): array
    {
        return DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->leftJoin('products', 'products.id', '=', 'order_items.product_id')
            ->leftJoin('categories', function ($join): void {
                $join->on('categories.id', '=', 'products.category_id')
                    ->orWhere(function ($query): void {
                        $query->whereNull('products.category_id')
                            ->whereColumn('categories.name', 'products.category');
                    });
            })
            ->where('orders.status', 'completed')
            ->selectRaw(
                'order_items.product_id,
                 order_items.product_name as name,
                 MAX(categories.name) as category,
                 SUM(order_items.quantity) as units_sold,
                 COALESCE(SUM(order_items.line_total), 0) as sales,
                 MAX(products.status) as status'
            )
            ->groupBy('order_items.product_id', 'order_items.product_name')
            ->orderByDesc('units_sold')
            ->limit(8)
            ->get()
            ->map(fn ($row): array => [
                'product_id' => $row->product_id !== null ? (int) $row->product_id : null,
                'name' => (string) $row->name,
                'category' => $row->category !== null ? (string) $row->category : 'Uncategorized',
                'units_sold' => (int) $row->units_sold,
                'sales' => round((float) $row->sales, 2),
                'status' => (string) ($row->status ?? 'archived'),
            ])
            ->values()
            ->all();
    }

    private function recentActivity(): array
    {
        $activities = [];

        $recentUsers = User::query()
            ->latest('created_at')
            ->limit(5)
            ->get(['id', 'name', 'role', 'status', 'created_at']);
        foreach ($recentUsers as $user) {
            $activities[] = [
                'user' => $user->name,
                'role' => $user->role,
                'action' => ucfirst(str_replace('_', ' ', (string) $user->role)).' account registered',
                'target' => 'Account',
                'date_time' => $user->created_at?->toIso8601String(),
                'status' => $user->status,
                'type' => 'user',
            ];
        }

        $recentProducts = Product::query()
            ->with('user:id,name,role')
            ->latest('created_at')
            ->limit(5)
            ->get(['id', 'name', 'user_id', 'status', 'created_at']);
        foreach ($recentProducts as $product) {
            $activities[] = [
                'user' => $product->user?->name ?? 'Seller',
                'role' => $product->user?->role ?? 'student',
                'action' => 'Listing submitted',
                'target' => $product->name,
                'date_time' => $product->created_at?->toIso8601String(),
                'status' => $product->status,
                'type' => 'product',
            ];
        }

        $recentOrders = Order::query()
            ->with('buyer:id,name,role')
            ->latest('created_at')
            ->limit(5)
            ->get(['id', 'order_number', 'buyer_id', 'buyer_name_snapshot', 'status', 'created_at']);
        foreach ($recentOrders as $order) {
            $activities[] = [
                'user' => $order->buyer?->name ?? $order->buyer_name_snapshot,
                'role' => $order->buyer?->role ?? 'student',
                'action' => 'Order placed',
                'target' => $order->order_number,
                'date_time' => $order->created_at?->toIso8601String(),
                'status' => $order->status,
                'type' => 'order',
            ];
        }

        $recentModeration = ProductModerationEvent::query()
            ->with(['product:id,name', 'actor:id,name,role'])
            ->latest('created_at')
            ->limit(5)
            ->get();
        foreach ($recentModeration as $event) {
            $activities[] = [
                'user' => $event->actor?->name ?? 'System',
                'role' => $event->actor?->role ?? 'admin',
                'action' => match ($event->to_status) {
                    'active' => 'Listing approved',
                    'rejected' => 'Listing rejected',
                    'suspended' => 'Listing suspended',
                    'archived' => 'Listing archived',
                    default => 'Listing moderation updated',
                },
                'target' => $event->product?->name ?? 'Removed listing',
                'date_time' => $event->created_at?->toIso8601String(),
                'status' => $event->to_status,
                'type' => 'moderation',
            ];
        }

        $recentComplaints = Complaint::query()
            ->with('user:id,name,role')
            ->latest('created_at')
            ->limit(5)
            ->get(['id', 'user_id', 'subject', 'status', 'created_at']);
        foreach ($recentComplaints as $complaint) {
            $activities[] = [
                'user' => $complaint->user?->name ?? 'Student',
                'role' => $complaint->user?->role ?? 'student',
                'action' => 'Complaint submitted',
                'target' => $complaint->subject,
                'date_time' => $complaint->created_at?->toIso8601String(),
                'status' => $complaint->status,
                'type' => 'complaint',
            ];
        }

        usort($activities, fn ($a, $b) => strtotime($b['date_time'] ?? '1970-01-01') <=> strtotime($a['date_time'] ?? '1970-01-01'));

        return array_slice($activities, 0, 12);
    }
}
