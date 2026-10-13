<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class StudentMiddleware
{
    public function handle(
        Request $request,
        Closure $next
    ): Response {
        // Check if user is logged in
        if (! $request->user()) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        // Check if account is active
        if ($request->user()->status !== 'active') {
            return response()->json([
                'message' => 'Your account is suspended.',
            ], 403);
        }

        // Check if user is a student
        if ($request->user()->role !== 'student') {
            return response()->json([
                'message' => 'Access denied. Student account required.',
            ], 403);
        }

        // Allow the request
        return $next($request);
    }
}
