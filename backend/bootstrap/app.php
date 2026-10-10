<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'subscription' => \App\Http\Middleware\CheckSubscription::class,
            'admin' => \App\Http\Middleware\EnsureUserIsAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'غير مصرح لك بالوصول، يرجى تسجيل الدخول',
            ], 401);
        });

        $exceptions->render(function (\Illuminate\Auth\Access\AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage() ?: 'ليس لديك الصلاحية للقيام بهذا الإجراء',
            ], 403);
        });

        $exceptions->render(function (\App\Exceptions\PosDomainException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'error_code' => $e->getErrorCode(),
            ], $e->getStatusCode());
        });
    })->create();
