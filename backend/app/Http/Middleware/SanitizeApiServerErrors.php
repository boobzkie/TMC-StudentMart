<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class SanitizeApiServerErrors
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $request->is('api', 'api/*') || $response->getStatusCode() < 500) {
            return $response;
        }

        Log::warning('API request returned a server error response.', [
            'method' => $request->method(),
            'route' => $request->route()?->uri() ?? 'unmatched',
            'status' => $response->getStatusCode(),
        ]);

        $headers = array_filter([
            'Retry-After' => $response->headers->get('Retry-After'),
        ]);

        return response()->json([
            'message' => 'The server could not complete this request. Please try again later.',
        ], $response->getStatusCode(), $headers);
    }
}
