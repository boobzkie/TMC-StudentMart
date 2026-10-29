<?php

namespace App\Http\Middleware;

use Closure;
use App\Models\User;
use App\Services\AccountEnforcementService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminOrStaffMiddleware
{
    public function handle(Request $request, Closure $next, ?string $permission = null): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        }

        if ($user instanceof User && $user->role === 'staff') {
            app(AccountEnforcementService::class)->expireIfDue($user);
        }

        if ($user->role === 'admin') {
            if (strtolower((string) $user->status) !== 'active') {
                return response()->json([
                    'success' => false,
                    'message' => 'Access denied. An active administrator account is required.',
                ], 403);
            }

            return $next($request);
        }

        if ($user->role === 'staff' && $user->status === 'active') {
            if ($permission && ! $user->hasStaffPermission($permission)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Your Staff account does not have permission to manage student accounts.',
                ], 403);
            }

            return $next($request);
        }

        return response()->json([
            'success' => false,
            'message' => 'Access denied. An active staff or administrator account is required.',
        ], 403);
    }
}
