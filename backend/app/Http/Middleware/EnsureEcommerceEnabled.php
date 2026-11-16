<?php

namespace App\Http\Middleware;

use App\Services\SubscriptionGate;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureEcommerceEnabled
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return $next($request);
        }

        $gate = SubscriptionGate::statusFor($user);
        if (empty($gate['ecommerce_enabled'])) {
            return response()->json([
                'success' => false,
                'error_code' => 'ECOMMERCE_ADDON_DISABLED',
                'message' => 'ميزة ربط المتجر الإلكتروني غير مفعّلة في باقتك الحالية. يرجى التواصل مع إدارة المنصة لتفعيلها.',
            ], 403);
        }

        return $next($request);
    }
}
