<?php

namespace App\Http\Middleware;

use App\Enums\SubscriptionStatus;
use App\Enums\UserStatus;
use App\Services\SubscriptionGate;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckSubscription
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return $next($request);
        }

        if ($user->status === UserStatus::INACTIVE) {
            $msg = $user->isOwner()
                ? 'تم تجميد حساب المنشأة من قبل إدارة المنصة. يرجى التواصل مع الدعم الفني.'
                : 'تم إيقاف حسابك من قبل صاحب العمل. يرجى مراجعة إدارة المؤسسة.';

            return $this->forbiddenResponse($msg);
        }

        $gate = SubscriptionGate::statusFor($user);
        if ($gate['frozen']) {
            return $this->forbiddenResponse('تم تجميد حساب المنشأة بالكامل من قبل إدارة المنصة. يرجى مراجعة إدارة المتجر.');
        }

        if (!$gate['active']) {
            return $this->forbiddenResponse(
                'عذراً، اشتراك المنشأة السنوي غير نشط أو منتهي الصلاحية. يرجى تجديد الاشتراك للمتابعة.',
                ['subscription_status' => $gate['subscription_status'] ?? SubscriptionStatus::NONE->value]
            );
        }

        return $next($request);
    }

    private function forbiddenResponse(string $message, array $extra = []): Response
    {
        return response()->json([
            'success' => false,
            'message' => $message,
            ...$extra,
        ], 403);
    }
}
