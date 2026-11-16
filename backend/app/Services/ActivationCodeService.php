<?php

namespace App\Services;

use App\Enums\AdminAuditAction;
use App\Enums\SubscriptionStatus;
use App\Models\ActivationCode;
use App\Models\Subscription;
use App\Models\User;
use App\Support\Money;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ActivationCodeService
{
    public function __construct(protected AdminAuditService $auditService) {}

    public function generateCodes(
        int $count = 1,
        int $durationDays = 365,
        string $plan = 'BASIC',
        ?string $notes = null,
        ?float $price = null,
        bool $ecommerceEnabled = false
    ): array {
        $batchRef = 'BATCH-' . strtoupper(Str::random(6));
        $resolvedPrice = $price !== null ? Money::of($price)->getAmount() : null;

        return DB::transaction(function () use ($count, $durationDays, $plan, $notes, $batchRef, $resolvedPrice, $ecommerceEnabled) {
            $generated = [];
            for ($i = 0; $i < $count; $i++) {
                $generated[] = ActivationCode::create([
                    'code' => 'KASH-' . strtoupper(Str::random(4)) . '-' . strtoupper(Str::random(4)) . '-' . strtoupper(Str::random(4)),
                    'duration_days' => $durationDays,
                    'plan' => $plan,
                    'price' => $resolvedPrice,
                    'ecommerce_enabled' => $ecommerceEnabled,
                    'is_used' => false,
                    'batch_reference' => $batchRef,
                    'notes' => $notes,
                ]);
            }
            $this->auditService->record(AdminAuditAction::LICENSES_GENERATED, "توليد {$count} كود تفعيل ({$plan}) لمدة {$durationDays} يوم", null, compact('count', 'durationDays', 'plan', 'resolvedPrice', 'ecommerceEnabled', 'batchRef'));
            return $generated;
        });
    }

    public function redeemCode(User $user, string $rawCode): array
    {
        $normalizedCode = strtoupper(trim($rawCode));

        try {
            return DB::transaction(fn () => $this->performRedeem($user, $normalizedCode));
        } catch (ValidationException $e) {
            $this->auditService->recordRedeemFailure($user, $normalizedCode, 'redeem_validation_failed');
            throw $e;
        }
    }

    public function revokeCode(int $codeId): ActivationCode
    {
        return DB::transaction(function () use ($codeId) {
            /** @var ActivationCode $activationCode */
            $activationCode = ActivationCode::where('id', $codeId)->lockForUpdate()->firstOrFail();

            if ($activationCode->is_used) {
                throw ValidationException::withMessages(['code' => ['لا يمكن إلغاء كود تفعيل تم استخدامه مسبقاً من قبل عميل.']]);
            }

            if ($activationCode->is_revoked) {
                throw ValidationException::withMessages(['code' => ['كود التفعيل هذا ملغي بالفعل مسبقاً.']]);
            }

            $activationCode->update(['is_revoked' => true, 'revoked_at' => now()]);

            $this->auditService->record(
                action: AdminAuditAction::LICENSE_REVOKED,
                summary: "إلغاء وحرق كود التفعيل ({$activationCode->code})",
                metadata: ['license_id' => $activationCode->id, 'code' => $activationCode->code],
                targetType: ActivationCode::class,
                targetId: $activationCode->id,
            );

            return $activationCode;
        });
    }

    private function performRedeem(User $user, string $normalizedCode): array
    {
        if (!$user->isOwner()) {
            throw ValidationException::withMessages([
                'code' => ['عذراً، تفعيل رخص الاشتراك متاح فقط لمالك المنشأة (Owner). يرجى مراجعة إدارة المتجر.'],
            ]);
        }

        $activationCode = $this->findRedeemableCode($normalizedCode);
        $activationCode->update(['is_used' => true, 'used_by_user_id' => $user->id, 'used_at' => now()]);

        [$subscription, $newEndDate] = $this->applyCodeSubscription($user, $activationCode);
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
                'status' => $subscription->status instanceof SubscriptionStatus ? $subscription->status->value : $subscription->status,
                'plan' => $subscription->plan,
                'end_date' => Carbon::parse($subscription->end_date)->format('Y-m-d'),
                'days_remaining' => $daysRemaining,
            ],
        ];
    }

    private function findRedeemableCode(string $normalizedCode): ActivationCode
    {
        $activationCode = ActivationCode::where('code', $normalizedCode)->lockForUpdate()->first();

        if (!$activationCode) {
            throw ValidationException::withMessages(['code' => ['كود التفعيل المدخل غير صحيح. يُرجى التأكد من كتابة الكود بشكل دقيق.']]);
        }
        if ($activationCode->is_revoked) {
            throw ValidationException::withMessages(['code' => ['كود التفعيل هذا تم إلغاؤه وإبطاله من قبل إدارة المنصة وغير صالح للاستخدام.']]);
        }
        if ($activationCode->is_used) {
            throw ValidationException::withMessages(['code' => ['عذراً، كود التفعيل هذا تم استخدامه مسبقاً وغير صالح للاستخدام مجدداً.']]);
        }

        return $activationCode;
    }

    /**
     * @return array{0: Subscription, 1: Carbon}
     */
    private function applyCodeSubscription(User $user, ActivationCode $activationCode): array
    {
        $subscription = Subscription::firstOrNew(['user_id' => $user->getAccountId()]);
        $currentEnd = ($subscription->exists && $subscription->end_date) ? Carbon::parse($subscription->end_date) : now();
        $baseDate = $currentEnd->isFuture() ? $currentEnd : now();
        $newEndDate = $baseDate->copy()->addDays($activationCode->duration_days);
        $priceMoney = Money::of($activationCode->price ?? config('pos.annual_subscription_price'));

        $subscription->fill([
            'status' => SubscriptionStatus::ACTIVE,
            'plan' => $activationCode->plan ?? 'BASIC',
            'start_date' => $subscription->start_date ?? now()->toDateString(),
            'end_date' => $newEndDate->toDateString(),
            'price' => $priceMoney->getAmount(),
            'notes' => 'تفعيل عبر كود: ' . $activationCode->code,
        ]);
        $subscription->save();
        if ($activationCode->ecommerce_enabled && !$user->ecommerce_enabled) {
            $user->forceFill(['ecommerce_enabled' => true])->save();
            SubscriptionGate::clear($user->id);
        }

        return [$subscription, $newEndDate];
    }
}
