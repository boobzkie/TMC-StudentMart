<?php

namespace App\Http\Controllers;

// @stats-extension: marketplace overview metrics

use App\Models\Product;
use App\Models\User;
use App\Models\Complaint;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    private const COURSES = ['BSIT', 'BSOA', 'BSCRIM', 'BSED', 'CAS'];
    private const LOW_STOCK_THRESHOLD = 5;

    public function stats(): JsonResponse
    {
        $totalUsers = User::count();
        $totalStudents = User::where('role', 'student')->count();
        $totalAdmins = User::where('role', 'admin')->count();
        $totalStaff = User::query()->where('role', 'staff')->where('status', '!=', 'archived')->count();
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
        $soldOutProducts = Product::where('status', 'sold_out')->count();
        $archivedProducts = Product::where('status', 'archived')->count();
        $newProducts = Product::where('created_at', '>=', now()->subDays(7))->count();

        $totalOrders = Order::count();
        $newOrders = Order::where('status', 'pending')->count();
        $processingOrders = Order::where('status', 'confirmed')->count();
        $readyForPickupOrders = Order::where('status', 'ready_for_pickup')->count();
        $completedOrders = Order::where('status', 'completed')->count();
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

        return response()->json([
            'success' => true,
            'stats' => [
                'total_users' => $totalUsers,
                'total_students' => $totalStudents,
                'total_admins' => $totalAdmins,
                'total_staff' => $totalStaff,
                'course_stats' => collect(self::COURSES)->mapWithKeys(fn ($course) => [$course => (int) ($courseCounts[$course] ?? 0)])->all(),
                'total_products' => $totalProducts,
                'pending_products' => $pendingProducts,
                'approved_products' => $approvedProducts,
                'active_products' => $approvedProducts,
                'rejected_products' => $rejectedProducts,
                'inactive_products' => $inactiveProducts,
                'sold_out_products' => $soldOutProducts,
                'archived_products' => $archivedProducts,
                'new_products' => $newProducts,
                'total_orders' => $totalOrders,
                'pending_orders' => $newOrders,
                'new_orders' => $newOrders,
                'processing_orders' => $processingOrders,
                'ready_for_pickup_orders' => $readyForPickupOrders,
                'completed_orders' => $completedOrders,
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
            ],
        ]);
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