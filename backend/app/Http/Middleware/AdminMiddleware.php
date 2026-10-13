<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminMiddleware
{
    /**
     * Handle an incoming request.
     */
    public function handle(
        Request $request,
        Closure $next
    ): Response {

        $user = $request->user();

        /*
        |--------------------------------------------------------------------------
        | Check Login
        |--------------------------------------------------------------------------
        */

        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthenticated.',
            ], 401);
        }

        /*
        |--------------------------------------------------------------------------
        | Check Admin Role
        |--------------------------------------------------------------------------
        */

        if (strtolower((string) $user->role) !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Access denied. Administrator privileges are required.',
                'role' => $user->role,
            ], 403);
        }

        if (strtolower((string) $user->status) !== 'active') {
            return response()->json([
                'success' => false,
                'message' => 'Access denied. An active administrator account is required.',
            ], 403);
        }

        /*
        |--------------------------------------------------------------------------
        | Allow Admin
        |--------------------------------------------------------------------------
        */

        return $next($request);
    }
}
