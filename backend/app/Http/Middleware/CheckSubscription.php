<?php

namespace App\Http\Middleware;

use App\Enums\UserStatus;
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
            if ($user->status === UserStatus::INACTIVE || $user->status?->value === 'INACTIVE' || $user->status === 'INACTIVE') {
                $msg = $user->isOwner()
                    ? 'تم تجميد حساب المنشأة من قبل إدارة المنصة. يرجى التواصل مع الدعم الفني.'
                    : 'تم إيقاف حسابك من قبل صاحب العمل. يرجى مراجعة إدارة المؤسسة.';

                return response()->json([
                    'success' => false,
                    'message' => $msg,
                ], 403);
            }

            // التحقق من اشتراك وحالة المنشأة الأم (سواء كان المستخدم هو صاحب العمل أو موظف تابع له)
            $owner = $user->owner_id ? $user->owner : $user;

            // إذا كان حساب مالك المتجر مجمداً من السوبر أدمن، يُمنع كافة موظفي المتجر فورياً
            if ($owner && ($owner->status === UserStatus::INACTIVE || $owner->status?->value === 'INACTIVE' || $owner->status === 'INACTIVE')) {
                return response()->json([
                    'success' => false,
                    'message' => 'تم تجميد حساب المنشأة بالكامل من قبل إدارة المنصة. يرجى مراجعة إدارة المتجر.',
                ], 403);
            }

            $subscription = $owner?->subscription;

            // إذا لم يكن لديه اشتراك أو كان اشتراكه منتهي الصلاحية وفترة السماح
            if (!$subscription || !$subscription->isActive()) {
                return response()->json([
                    'success' => false,
                    'message' => 'عذراً، اشتراك المنشأة السنوي غير نشط أو منتهي الصلاحية. يرجى تجديد الاشتراك للمتابعة.',
                    'subscription_status' => $subscription?->status ?? 'NONE',
                ], 403);
            }
        }

        return $next($request);
    }
}
