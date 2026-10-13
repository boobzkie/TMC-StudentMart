<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    private const COURSES = ['BSIT', 'BSOA', 'BSCRIM', 'BSED', 'CAS'];

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
            ],
        ]);
    }
}