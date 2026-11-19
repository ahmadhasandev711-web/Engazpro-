<?php

namespace App\Services\WooCommerce;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\EcommercePlatform;
use App\Enums\PromotionDiscountType;
use App\Enums\PromotionSyncSource;
use App\Enums\PromotionType;
use App\Models\Promotion;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\EcommerceSyncEchoGuard;
use App\Support\Money;
use Carbon\Carbon;

class WooCommercePromotionSyncService
{
    public function __construct(
        protected WooCommerceApiClientInterface $apiClient
    ) {}

    public function isEligible(WooCommerceIntegration $integration, Promotion $promotion): bool
    {
        $type = $promotion->type instanceof PromotionType ? $promotion->type : PromotionType::tryFrom((string) $promotion->type);
        if ($type !== PromotionType::COUPON || !$promotion->sync_to_ecommerce || empty($promotion->code)) {
            return false;
        }

        return $promotion->branch_id === null || (int) $integration->online_branch_id === (int) $promotion->branch_id;
    }

    public function pushPromotion(WooCommerceIntegration $integration, Promotion $promotion): bool
    {
        if (!$this->isEligible($integration, $promotion)) {
            return false;
        }

        $payload = $this->buildRemotePayload($promotion);
        $this->recordPushEcho((int) $integration->user_id, $promotion);

        $remote = $promotion->wc_coupon_id
            ? $this->apiClient->updateCoupon($integration, (int) $promotion->wc_coupon_id, $payload)
            : $this->apiClient->createCoupon($integration, $payload);

        return $this->persistPushOutcome($promotion, $remote);
    }

    public function deleteRemotePromotion(WooCommerceIntegration $integration, int $wcCouponId): bool
    {
        EcommerceSyncEchoGuard::recordEcho(EcommercePlatform::WOOCOMMERCE, 'coupon_delete', (int) $integration->user_id, $wcCouponId, 'deleted');

        return $this->apiClient->deleteCoupon($integration, $wcCouponId);
    }

    /**
     * @return array{imported: int, updated: int, skipped: int}
     */
    public function pullCoupons(User $user, WooCommerceIntegration $integration): array
    {
        $stats = ['imported' => 0, 'updated' => 0, 'skipped' => 0];
        $page = 1;

        EcommerceSyncEchoGuard::suppressDuring($user->getAccountId(), function () use ($user, $integration, &$stats, &$page): void {
            do {
                $batch = $this->apiClient->getCoupons($integration, $page, 50);
                foreach ($batch as $row) {
                    $outcome = $this->ingestSingleRemoteCoupon($user, $integration, $row);
                    $stats[$outcome]++;
                }
                $page++;
            } while (count($batch) === 50);
        });

        return $stats;
    }

    public function ingestCouponWebhook(User $user, WooCommerceIntegration $integration, string $topic, array $payload): void
    {
        $wcId = (int) ($payload['id'] ?? 0);
        if (!$wcId) {
            return;
        }

        EcommerceSyncEchoGuard::suppressDuring($user->getAccountId(), function () use ($user, $integration, $topic, $payload, $wcId): void {
            if ($topic === 'coupon.deleted') {
                $this->handleDeletedCouponWebhook($user->getAccountId(), $wcId);
                return;
            }
            $this->ingestSingleRemoteCoupon($user, $integration, $payload, respectEcho: true);
        });
    }

    private function handleDeletedCouponWebhook(int $accountId, int $wcId): void
    {
        if (EcommerceSyncEchoGuard::matchesAndConsumeEcho(EcommercePlatform::WOOCOMMERCE, 'coupon_delete', $accountId, $wcId, 'deleted')) {
            return;
        }
        Promotion::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->where('wc_coupon_id', $wcId)
            ->delete();
    }

    private function ingestSingleRemoteCoupon(User $user, WooCommerceIntegration $integration, array $row, bool $respectEcho = false): string
    {
        $wcId = (int) ($row['id'] ?? 0);
        $code = strtoupper(trim((string) ($row['code'] ?? '')));
        $mappedType = $this->mapRemoteDiscountType((string) ($row['discount_type'] ?? ''));
        if (!$wcId || $code === '' || $mappedType === null) {
            return 'skipped';
        }

        $isActive = ($row['status'] ?? 'publish') === 'publish';
        $fingerprint = EcommerceSyncEchoGuard::couponFingerprint($code, $mappedType, $row['amount'] ?? 0, $isActive);
        if ($respectEcho && EcommerceSyncEchoGuard::matchesAndConsumeEcho(EcommercePlatform::WOOCOMMERCE, 'coupon', $user->getAccountId(), $code, $fingerprint)) {
            return 'skipped';
        }

        return $this->upsertLocalCoupon($user->getAccountId(), $integration, $wcId, $code, $mappedType, $row, $isActive);
    }

    private function upsertLocalCoupon(int $accountId, WooCommerceIntegration $integration, int $wcId, string $code, string $discountType, array $row, bool $isActive): string
    {
        $existing = Promotion::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->where(fn ($q) => $q->where('wc_coupon_id', $wcId)->orWhere('code', $code))
            ->first();

        $attrs = $this->buildLocalAttributes($integration, $wcId, $code, $discountType, $row, $isActive, $existing);
        if ($existing) {
            $existing->update($attrs);
            return 'updated';
        }

        Promotion::create(['user_id' => $accountId, 'sync_source' => PromotionSyncSource::WOOCOMMERCE->value, ...$attrs]);

        return 'imported';
    }

    private function buildLocalAttributes(WooCommerceIntegration $integration, int $wcId, string $code, string $discountType, array $row, bool $isActive, ?Promotion $existing): array
    {
        $endsAt = !empty($row['date_expires']) ? Carbon::parse((string) $row['date_expires'])->toDateString() : null;

        return [
            'name' => $existing?->name ?: ($row['description'] ?: "كوبون {$code}"),
            'code' => $code,
            'type' => PromotionType::COUPON->value,
            'discount_type' => $discountType,
            'discount_value' => Money::of($row['amount'] ?? 0)->getAmount(),
            'branch_id' => $existing ? $existing->branch_id : $integration->online_branch_id,
            'min_order_amount' => Money::of($row['minimum_amount'] ?? 0)->getAmount(),
            'max_uses' => !empty($row['usage_limit']) ? (int) $row['usage_limit'] : null,
            'used_count' => isset($row['usage_count']) ? (int) $row['usage_count'] : ($existing?->used_count ?? 0),
            'ends_at' => $endsAt,
            'is_active' => $isActive,
            'wc_coupon_id' => $wcId,
            'sync_to_ecommerce' => true,
            'last_synced_at' => now(),
            'sync_error' => null,
        ];
    }

    private function buildRemotePayload(Promotion $promotion): array
    {
        $discountType = ($promotion->discount_type === PromotionDiscountType::PERCENTAGE) ? 'percent' : 'fixed_cart';
        $minOrder = Money::of($promotion->min_order_amount ?? 0);

        return array_filter([
            'code' => strtolower(trim((string) $promotion->code)),
            'discount_type' => $discountType,
            'amount' => Money::of($promotion->discount_value ?? 0)->toDecimalString(),
            'description' => $promotion->name,
            'minimum_amount' => $minOrder->isPositive() ? $minOrder->toDecimalString() : '',
            'usage_limit' => $promotion->max_uses,
            'date_expires' => $promotion->ends_at?->endOfDay()->toIso8601String(),
            'status' => $promotion->is_active ? 'publish' : 'draft',
        ], fn ($v) => $v !== null);
    }

    private function persistPushOutcome(Promotion $promotion, ?array $remote): bool
    {
        $ok = is_array($remote) && !empty($remote['id']);

        EcommerceSyncEchoGuard::suppressDuring((int) $promotion->user_id, function () use ($promotion, $remote, $ok): void {
            $promotion->update([
                'wc_coupon_id' => $ok ? (int) $remote['id'] : $promotion->wc_coupon_id,
                'last_synced_at' => $ok ? now() : $promotion->last_synced_at,
                'sync_error' => $ok ? null : 'تعذر مزامنة الكوبون مع WooCommerce، تحقق من المفاتيح وصلاحيات القراءة/الكتابة.',
            ]);
        });

        return $ok;
    }

    private function recordPushEcho(int $accountId, Promotion $promotion): void
    {
        $discountType = $promotion->discount_type instanceof PromotionDiscountType
            ? $promotion->discount_type->value
            : (string) $promotion->discount_type;

        EcommerceSyncEchoGuard::recordEcho(
            EcommercePlatform::WOOCOMMERCE,
            'coupon',
            $accountId,
            strtoupper(trim((string) $promotion->code)),
            EcommerceSyncEchoGuard::couponFingerprint((string) $promotion->code, $discountType, $promotion->discount_value, (bool) $promotion->is_active)
        );
    }

    private function mapRemoteDiscountType(string $wcType): ?string
    {
        return match ($wcType) {
            'percent' => PromotionDiscountType::PERCENTAGE->value,
            'fixed_cart', 'fixed_product' => PromotionDiscountType::FIXED_AMOUNT->value,
            default => null,
        };
    }
}
