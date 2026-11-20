<?php

use App\Http\Middleware\AdminMiddleware;
use App\Http\Middleware\AdminOrStaffMiddleware;
use App\Http\Middleware\SanitizeApiServerErrors;
use App\Http\Middleware\StaffMiddleware;
use App\Http\Middleware\StudentMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(
    basePath: dirname(__DIR__)
)
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'admin' => AdminMiddleware::class,
            'admin.or.staff' => AdminOrStaffMiddleware::class,
            'staff' => StaffMiddleware::class,
            'student' => StudentMiddleware::class,
        ]);

        $middleware->api(append: [SanitizeApiServerErrors::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $isApiRequest = fn (Request $request): bool => $request->is('api', 'api/*');

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request, Throwable $exception): bool => $isApiRequest($request) || $request->expectsJson()
        );
    })
    ->create();
