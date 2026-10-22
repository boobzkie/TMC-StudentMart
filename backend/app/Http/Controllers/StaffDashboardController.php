<?php

namespace App\Http\Controllers;

use App\Models\Complaint;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffDashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $stats = [];
        $recentStudents = null;

        if ($user->hasStaffPermission('manage_students')) {
            $students = User::query()->where('role', 'student');

            $stats = array_merge($stats, [
                'total_students' => (clone $students)->count(),
                'active_students' => (clone $students)->where('status', 'active')->count(),
                'inactive_students' => (clone $students)->where('status', '!=', 'active')->count(),
                'new_students_30_days' => (clone $students)->where('created_at', '>=', now()->subDays(30))->count(),
            ]);

            $recentStudents = (clone $students)
                ->select(['id', 'name', 'student_id', 'email', 'status', 'created_at'])
                ->orderByDesc('created_at')
                ->limit(8)
                ->get();
        }

        if ($user->hasStaffPermission('moderate_products')) {
            $stats['pending_products'] = Product::query()
                ->where('status', 'pending')
                ->count();
        }

        if ($user->hasStaffPermission('manage_complaints')) {
            $complaintCounts = Complaint::query()
                ->selectRaw('status, COUNT(*) as total')
                ->whereIn('status', ['pending', 'in_review'])
                ->groupBy('status')
                ->pluck('total', 'status');

            $pending = (int) ($complaintCounts['pending'] ?? 0);
            $inReview = (int) ($complaintCounts['in_review'] ?? 0);
            $stats['pending_complaints'] = $pending;
            $stats['in_review_complaints'] = $inReview;
            $stats['open_complaints'] = $pending + $inReview;
        }

        return response()->json([
            'success' => true,
            'stats' => $stats,
            'recent_students' => $recentStudents,
        ]);
    }
}
