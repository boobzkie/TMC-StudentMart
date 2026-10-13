<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;

class StaffDashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        $students = User::query()->where('role', 'student');

        return response()->json([
            'success' => true,
            'stats' => [
                'total_students' => (clone $students)->count(),
                'active_students' => (clone $students)->where('status', 'active')->count(),
                'inactive_students' => (clone $students)->where('status', '!=', 'active')->count(),
                'new_students_30_days' => (clone $students)->where('created_at', '>=', now()->subDays(30))->count(),
            ],
            'recent_students' => (clone $students)
                ->select(['id', 'name', 'student_id', 'email', 'status', 'created_at'])
                ->orderByDesc('created_at')
                ->limit(8)
                ->get(),
        ]);
    }
}