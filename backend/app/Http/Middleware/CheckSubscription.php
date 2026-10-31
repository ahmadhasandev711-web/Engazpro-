<?php

namespace App\Http\Middleware;

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

        if ($user) {
            // التحقق من حالة المستخدم نفسه
            if ($user->status === UserStatus::INACTIVE) {
                $msg = $user->isOwner()
                    ? 'تم تجميد حساب المنشأة من قبل إدارة المنصة. يرجى التواصل مع الدعم الفني.'
                    : 'تم إيقاف حسابك من قبل صاحب العمل. يرجى مراجعة إدارة المؤسسة.';

                return response()->json([
                    'success' => false,
                    'message' => $msg,
                ], 403);
            }

            // التحقق من اشتراك وحالة المنشأة الأم عبر SubscriptionGate المزود بالكاش
            $gate = SubscriptionGate::statusFor($user);

            // إذا كان حساب مالك المتجر مجمداً من السوبر أدمن، يُمنع كافة موظفي المتجر فورياً
            if ($gate['frozen']) {
                return response()->json([
                    'success' => false,
                    'message' => 'تم تجميد حساب المنشأة بالكامل من قبل إدارة المنصة. يرجى مراجعة إدارة المتجر.',
                ], 403);
            }

            // إذا لم يكن لديه اشتراك أو كان اشتراكه منتهي الصلاحية وفترة السماح
            if (!$gate['active']) {
                return response()->json([
                    'success' => false,
                    'message' => 'عذراً، اشتراك المنشأة السنوي غير نشط أو منتهي الصلاحية. يرجى تجديد الاشتراك للمتابعة.',
                    'subscription_status' => $gate['subscription_status'] ?? 'NONE',
                ], 403);
            }
        }

        return $next($request);
    }
}
