<?php

namespace App\Services;

use App\Models\ActivationCode;
use App\Models\Subscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ActivationCodeService
{
    /**
     * توليد كود تفعيل أو مجموعة أكواد تفعيل جديدة فريدة
     */
    public function generateCodes(int $count = 1, int $durationDays = 365, string $plan = 'BASIC', ?string $notes = null): array
    {
        $batchRef = 'BATCH-' . strtoupper(Str::random(6));
        $generated = [];

        for ($i = 0; $i < $count; $i++) {
            $code = 'KASH-' . strtoupper(Str::random(4)) . '-' . strtoupper(Str::random(4)) . '-' . strtoupper(Str::random(4));

            $activationCode = ActivationCode::create([
                'code' => $code,
                'duration_days' => $durationDays,
                'plan' => $plan,
                'is_used' => false,
                'batch_reference' => $batchRef,
                'notes' => $notes,
            ]);

            $generated[] = $activationCode;
        }

        return $generated;
    }

    /**
     * تفعيل كود الاشتراك ذرياً لمستخدم
     */
    public function redeemCode(User $user, string $rawCode): array
    {
        $normalizedCode = strtoupper(trim($rawCode));

        return DB::transaction(function () use ($user, $normalizedCode) {
            if (!$user->isOwner()) {
                throw ValidationException::withMessages([
                    'code' => ['عذراً، تفعيل رخص الاشتراك متاح فقط لمالك المنشأة (Owner). يرجى مراجعة إدارة المتجر.'],
                ]);
            }

            /** @var ActivationCode|null $activationCode */
            $activationCode = ActivationCode::where('code', $normalizedCode)
                ->lockForUpdate()
                ->first();

            if (!$activationCode) {
                throw ValidationException::withMessages([
                    'code' => ['كود التفعيل المدخل غير صحيح. يُرجى التأكد من كتابة الكود بشكل دقيق.'],
                ]);
            }

            if ($activationCode->is_revoked) {
                throw ValidationException::withMessages([
                    'code' => ['كود التفعيل هذا تم إلغاؤه وإبطاله من قبل إدارة المنصة وغير صالح للاستخدام.'],
                ]);
            }

            if ($activationCode->is_used) {
                throw ValidationException::withMessages([
                    'code' => ['عذراً، كود التفعيل هذا تم استخدامه مسبقاً وغير صالح للاستخدام مجدداً.'],
                ]);
            }

            // حرق الكود وتسجيل بيانات المستخدم وتاريخ التفعيل
            $activationCode->update([
                'is_used' => true,
                'used_by_user_id' => $user->id,
                'used_at' => now(),
            ]);

            // تمديد أو إنشاء اشتراك المستخدم على حساب المتجر الرئيسي
            $accountId = $user->getAccountId();
            $subscription = Subscription::firstOrNew(['user_id' => $accountId]);

            $currentEnd = ($subscription->exists && $subscription->end_date)
                ? Carbon::parse($subscription->end_date)
                : now();

            $baseDate = $currentEnd->isFuture() ? $currentEnd : now();
            $newEndDate = $baseDate->copy()->addDays($activationCode->duration_days);

            $subscription->fill([
                'status' => 'ACTIVE',
                'plan' => $activationCode->plan ?? 'BASIC',
                'start_date' => $subscription->start_date ?? now()->toDateString(),
                'end_date' => $newEndDate->toDateString(),
                'price' => (float) config('pos.annual_subscription_price', 500.00),
                'notes' => 'تفعيل عبر كود: ' . $activationCode->code,
            ]);

            $subscription->save();

            $daysRemaining = max(0, (int) ceil(now()->diffInDays($newEndDate, false)));

            return [
                'success' => true,
                'message' => "تم تفعيل اشتراكك بنجاح لمدة {$activationCode->duration_days} يوم! 🎉",
                'code' => $activationCode->code,
                'duration_days' => $activationCode->duration_days,
                'end_date' => $newEndDate->toDateString(),
                'days_remaining' => $daysRemaining,
                'subscription' => [
                    'id' => $subscription->id,
                    'status' => $subscription->status,
                    'plan' => $subscription->plan,
                    'end_date' => Carbon::parse($subscription->end_date)->format('Y-m-d'),
                    'days_remaining' => $daysRemaining,
                ],
            ];
        });
    }

    /**
     * إلغاء وحرق كود تفعيل غير مستخدم
     */
    public function revokeCode(int $codeId): ActivationCode
    {
        return DB::transaction(function () use ($codeId) {
            /** @var ActivationCode $activationCode */
            $activationCode = ActivationCode::where('id', $codeId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($activationCode->is_used) {
                throw ValidationException::withMessages([
                    'code' => ['لا يمكن إلغاء كود تفعيل تم استخدامه مسبقاً من قبل عميل.'],
                ]);
            }

            if ($activationCode->is_revoked) {
                throw ValidationException::withMessages([
                    'code' => ['كود التفعيل هذا ملغي بالفعل مسبقاً.'],
                ]);
            }

            $activationCode->update([
                'is_revoked' => true,
                'revoked_at' => now(),
            ]);

            return $activationCode;
        });
    }
}
