<?php

namespace App\Http\Middleware;

use Closure;
use App\Models\User;
use App\Services\AccountEnforcementService;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class StudentMiddleware
{
    public function handle(
        Request $request,
        Closure $next
    ): Response {
        $user = $request->user();

        // A timed suspension is lifted on the first authenticated request after expiry.
        if ($user instanceof User && $user->role === 'student') {
            app(AccountEnforcementService::class)->expireIfDue($user);
        }

        if (! $user) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        // Check if account is active
        if ($user->status !== 'active') {
            return response()->json([
                'message' => 'Your account is suspended.',
            ], 403);
        }

        // Check if user is a student
        if ($user->role !== 'student') {
            return response()->json([
                'message' => 'Access denied. Student account required.',
            ], 403);
        }

        // Allow the request
        return $next($request);
    }
}
