<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class StaffMiddleware
{
    public function handle(Request $request, Closure $next, ?string $permission = null): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        if ($user->role !== 'staff' || $user->status !== 'active') {
            return response()->json([
                'success' => false,
                'message' => 'Access denied. An approved, active Staff account is required.',
            ], 403);
        }

        if ($permission && ! $user->hasStaffPermission($permission)) {
            return response()->json([
                'success' => false,
                'message' => 'Your Staff account does not have the required permission for this feature.',
            ], 403);
        }

        return $next($request);
    }
}