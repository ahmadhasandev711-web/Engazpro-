<?php

namespace App\Services\Shopify;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\EcommercePlatform;
use App\Enums\PromotionDiscountType;
use App\Enums\PromotionSyncSource;
use App\Enums\PromotionType;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\ShopifyIntegration;
use App\Models\User;
use App\Services\EcommerceSyncEchoGuard;
use App\Support\Money;
use App\Support\ShopifyGid;
use Carbon\Carbon;

class ShopifyPromotionSyncService
{
    public function __construct(
        protected ShopifyGraphqlClientInterface $graphqlClient
    ) {}

    public function isEligible(ShopifyIntegration $integration, Promotion $promotion): bool
    {
        $type = $this->resolvePromotionType($promotion);
        if (!$promotion->sync_to_ecommerce || !in_array($type, [PromotionType::COUPON, PromotionType::BUY_X_GET_Y], true)) {
            return false;
        }

        return $promotion->branch_id === null || (int) $integration->default_branch_id === (int) $promotion->branch_id;
    }

    public function pushPromotion(ShopifyIntegration $integration, Promotion $promotion): bool
    {
        if (!$this->isEligible($integration, $promotion)) {
            return false;
        }

        try {
            $gid = $this->executePushMutation($integration, $promotion);
            $this->recordPushSuccess($promotion, $gid);
            return true;
        } catch (\Throwable $e) {
            $this->recordPushFailure($integration, $promotion, $e->getMessage());
            return false;
        }
    }

    public function deleteRemotePromotion(ShopifyIntegration $integration, string $discountGid): void
    {
        EcommerceSyncEchoGuard::recordEcho(EcommercePlatform::SHOPIFY, 'discount_delete', (int) $integration->user_id, $discountGid, 'deleted');
        if (str_contains($discountGid, 'DiscountAutomaticNode')) {
            $this->graphqlClient->deleteAutomaticDiscount($integration, $discountGid);
            return;
        }
        $this->graphqlClient->deleteCodeDiscount($integration, $discountGid);
    }

    /**
     * @return array{imported: int, updated: int, skipped: int}
     */
    public function pullPromotions(User $user, ShopifyIntegration $integration): array
    {
        $stats = ['imported' => 0, 'updated' => 0, 'skipped' => 0];

        EcommerceSyncEchoGuard::suppressDuring($user->getAccountId(), function () use ($user, $integration, &$stats): void {
            $this->pullPagedNodes($integration, fn ($c) => $this->graphqlClient->getCodeDiscountsPage($integration, $c, 50), function (array $node) use ($user, $integration, &$stats): void {
                $outcome = $this->ingestCodeDiscountNode($user->getAccountId(), $integration, $node['id'] ?? '', (array) ($node['codeDiscount'] ?? []));
                $stats[$outcome]++;
            });
            $this->pullPagedNodes($integration, fn ($c) => $this->graphqlClient->getAutomaticDiscountsPage($integration, $c, 50), function (array $node) use ($user, $integration, &$stats): void {
                $outcome = $this->ingestAutomaticBxgyNode($user->getAccountId(), $integration, $node['id'] ?? '', (array) ($node['automaticDiscount'] ?? []));
                $stats[$outcome]++;
            });
        });

        return $stats;
    }

    public function ingestDiscountWebhook(User $user, ShopifyIntegration $integration, string $topic, array $payload): void
    {
        $gid = (string) ($payload['admin_graphql_api_id'] ?? '');
        if ($gid === '') {
            return;
        }

        EcommerceSyncEchoGuard::suppressDuring($user->getAccountId(), function () use ($user, $integration, $topic, $gid): void {
            if ($topic === 'discounts/delete') {
                $this->handleDeletedDiscount($user->getAccountId(), $gid);
                return;
            }
            $node = $this->graphqlClient->getDiscountNodeById($integration, $gid);
            if ($node && !empty($node['discount'])) {
                $this->dispatchNodeIngestion($user->getAccountId(), $integration, (string) ($node['id'] ?? $gid), (array) $node['discount']);
            }
        });
    }

    private function executePushMutation(ShopifyIntegration $integration, Promotion $promotion): string
    {
        $type = $this->resolvePromotionType($promotion);
        if ($type === PromotionType::BUY_X_GET_Y) {
            return $this->pushAutomaticBxgy($integration, $promotion);
        }

        return $this->pushCodeCoupon($integration, $promotion);
    }

    private function pushCodeCoupon(ShopifyIntegration $integration, Promotion $promotion): string
    {
        $gid = (string) ($promotion->shopify_discount_id ?? '');
        if (!$promotion->is_active && $gid !== '') {
            EcommerceSyncEchoGuard::recordEcho(EcommercePlatform::SHOPIFY, 'discount_gid', (int) $integration->user_id, $gid, 'deactivated');
            $this->graphqlClient->deactivateCodeDiscount($integration, $gid);
            return $gid;
        }

        $this->recordCouponPushEcho((int) $integration->user_id, $promotion);
        $input = $this->buildCodeDiscountInput($promotion);

        return $gid !== ''
            ? $this->graphqlClient->updateCodeBasicDiscount($integration, $gid, $input)
            : $this->graphqlClient->createCodeBasicDiscount($integration, $input);
    }

    private function pushAutomaticBxgy(ShopifyIntegration $integration, Promotion $promotion): string
    {
        $input = $this->buildBxgyDiscountInput($promotion);
        $gid = (string) ($promotion->shopify_discount_id ?? '');
        if ($gid !== '') {
            EcommerceSyncEchoGuard::recordEcho(EcommercePlatform::SHOPIFY, 'discount_gid', (int) $integration->user_id, $gid, 'updated');
            return $this->graphqlClient->updateAutomaticBxgyDiscount($integration, $gid, $input);
        }

        return $this->graphqlClient->createAutomaticBxgyDiscount($integration, $input);
    }

    private function buildCodeDiscountInput(Promotion $promotion): array
    {
        $discountType = $promotion->discount_type instanceof PromotionDiscountType ? $promotion->discount_type : PromotionDiscountType::from((string) $promotion->discount_type);
        $valueInput = $discountType === PromotionDiscountType::PERCENTAGE
            ? ['percentage' => $this->percentageToShopifyRatio($promotion->discount_value)]
            : ['discountAmount' => ['amount' => Money::of($promotion->discount_value ?? 0)->toDecimalString(), 'appliesOnEachItem' => false]];

        $input = [
            'title' => $promotion->name,
            'code' => strtoupper(trim((string) $promotion->code)),
            'startsAt' => ($promotion->starts_at ?? now())->startOfDay()->toIso8601String(),
            'customerSelection' => ['all' => true],
            'customerGets' => ['value' => $valueInput, 'items' => $this->buildItemsScope($promotion)],
            'combinesWith' => ['orderDiscounts' => false, 'productDiscounts' => true, 'shippingDiscounts' => true],
        ];
        if ($promotion->ends_at) {
            $input['endsAt'] = $promotion->ends_at->endOfDay()->toIso8601String();
        }
        if ($promotion->max_uses) {
            $input['usageLimit'] = (int) $promotion->max_uses;
        }
        $minOrder = Money::of($promotion->min_order_amount ?? 0);
        if ($minOrder->isPositive()) {
            $input['minimumRequirement'] = ['subtotal' => ['greaterThanOrEqualToSubtotal' => $minOrder->toDecimalString()]];
        }

        return $input;
    }

    private function buildBxgyDiscountInput(Promotion $promotion): array
    {
        $itemsScope = $this->buildItemsScope($promotion);
        $getPercentRatio = $this->percentageToShopifyRatio($promotion->discount_value ?? 100);
        $input = [
            'title' => $promotion->name,
            'startsAt' => ($promotion->starts_at ?? now())->startOfDay()->toIso8601String(),
            'customerBuys' => ['value' => ['quantity' => (string) max(1, (int) ($promotion->buy_quantity ?? 1))], 'items' => $itemsScope],
            'customerGets' => ['value' => ['discountOnQuantity' => ['quantity' => (string) max(1, (int) ($promotion->get_quantity ?? 1)), 'effect' => ['percentage' => $getPercentRatio]]], 'items' => $itemsScope],
            'combinesWith' => ['orderDiscounts' => false, 'productDiscounts' => true, 'shippingDiscounts' => true],
        ];
        if ($promotion->ends_at) {
            $input['endsAt'] = $promotion->ends_at->endOfDay()->toIso8601String();
        }

        return $input;
    }

    private function buildItemsScope(Promotion $promotion): array
    {
        if ($promotion->product_id) {
            $shopifyProductId = Product::withoutGlobalScopes()->whereKey($promotion->product_id)->value('shopify_product_id');
            if ($shopifyProductId) {
                return ['products' => ['productsToAdd' => [ShopifyGid::toGid('Product', (int) $shopifyProductId)]]];
            }
        }

        return ['all' => true];
    }

    private function pullPagedNodes(ShopifyIntegration $integration, callable $fetchPage, callable $onNode): void
    {
        $cursor = null;
        do {
            $page = $fetchPage($cursor);
            foreach ($page['nodes'] as $node) {
                $onNode($node);
            }
            $cursor = $page['end_cursor'];
        } while ($page['has_next_page'] && $cursor);
    }

    private function dispatchNodeIngestion(int $accountId, ShopifyIntegration $integration, string $gid, array $discount): void
    {
        if (!empty($discount['codes'])) {
            $this->ingestCodeDiscountNode($accountId, $integration, $gid, $discount, respectEcho: true);
            return;
        }
        if (!empty($discount['customerBuys'])) {
            $this->ingestAutomaticBxgyNode($accountId, $integration, $gid, $discount, respectEcho: true);
        }
    }

    private function ingestCodeDiscountNode(int $accountId, ShopifyIntegration $integration, string $gid, array $discount, bool $respectEcho = false): string
    {
        $code = strtoupper(trim((string) ($discount['codes']['nodes'][0]['code'] ?? '')));
        [$discountType, $discountValue] = $this->extractCodeDiscountValue((array) ($discount['customerGets']['value'] ?? []));
        if ($gid === '' || $code === '' || $discountType === null) {
            return 'skipped';
        }
        $isActive = $this->isRemoteDiscountActive($discount);
        if ($respectEcho && $this->isOutgoingCouponEcho($accountId, $gid, $code, $discountType, $discountValue, $isActive)) {
            return 'skipped';
        }

        return $this->upsertRemotePromotion($accountId, $integration, $gid, [
            'name' => (string) ($discount['title'] ?? $code), 'code' => $code, 'type' => PromotionType::COUPON->value,
            'discount_type' => $discountType, 'discount_value' => $discountValue,
            'min_order_amount' => Money::of($discount['minimumRequirement']['greaterThanOrEqualToSubtotal']['amount'] ?? 0)->getAmount(),
            'max_uses' => !empty($discount['usageLimit']) ? (int) $discount['usageLimit'] : null,
            'used_count' => isset($discount['asyncUsageCount']) ? (int) $discount['asyncUsageCount'] : 0,
            'starts_at' => $this->parseDate($discount['startsAt'] ?? null), 'ends_at' => $this->parseDate($discount['endsAt'] ?? null),
            'is_active' => $isActive,
        ], $code);
    }

    private function ingestAutomaticBxgyNode(int $accountId, ShopifyIntegration $integration, string $gid, array $discount, bool $respectEcho = false): string
    {
        $buyQty = (int) ($discount['customerBuys']['value']['quantity'] ?? 0);
        $getQty = (int) ($discount['customerGets']['value']['quantity']['quantity'] ?? 0);
        $pctRatio = $discount['customerGets']['value']['effect']['percentage'] ?? null;
        if ($gid === '' || $buyQty < 1 || $getQty < 1 || $pctRatio === null) {
            return 'skipped';
        }
        if ($respectEcho && EcommerceSyncEchoGuard::matchesAndConsumeEcho(EcommercePlatform::SHOPIFY, 'discount_gid', $accountId, $gid, 'updated')) {
            return 'skipped';
        }

        return $this->upsertRemotePromotion($accountId, $integration, $gid, [
            'name' => (string) ($discount['title'] ?? "اشترِ {$buyQty} واحصل على {$getQty}"),
            'code' => null, 'type' => PromotionType::BUY_X_GET_Y->value, 'discount_type' => PromotionDiscountType::PERCENTAGE->value,
            'discount_value' => $this->shopifyRatioToPercentage($pctRatio), 'buy_quantity' => $buyQty, 'get_quantity' => $getQty,
            'min_order_amount' => 0, 'starts_at' => $this->parseDate($discount['startsAt'] ?? null),
            'ends_at' => $this->parseDate($discount['endsAt'] ?? null),
            'is_active' => $this->isRemoteDiscountActive($discount),
        ]);
    }

    private function isRemoteDiscountActive(array $discount): bool
    {
        return strtolower((string) ($discount['status'] ?? 'active')) === 'active';
    }

    private function upsertRemotePromotion(int $accountId, ShopifyIntegration $integration, string $gid, array $attrs, ?string $code = null): string
    {
        $existing = Promotion::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->where(function ($q) use ($gid, $code): void {
                $q->where('shopify_discount_id', $gid);
                if ($code !== null) {
                    $q->orWhere('code', $code);
                }
            })->first();

        $payload = [...$attrs, 'shopify_discount_id' => $gid, 'branch_id' => $existing ? $existing->branch_id : $integration->default_branch_id, 'sync_to_ecommerce' => true, 'last_synced_at' => now(), 'sync_error' => null];
        if ($existing) {
            $existing->update($payload);
            return 'updated';
        }

        Promotion::create(['user_id' => $accountId, 'sync_source' => PromotionSyncSource::SHOPIFY->value, ...$payload]);

        return 'imported';
    }

    /**
     * @return array{0: ?string, 1: float}
     */
    private function extractCodeDiscountValue(array $value): array
    {
        if (array_key_exists('percentage', $value)) {
            return [PromotionDiscountType::PERCENTAGE->value, $this->shopifyRatioToPercentage($value['percentage'])];
        }
        if (isset($value['amount']['amount'])) {
            return [PromotionDiscountType::FIXED_AMOUNT->value, Money::of($value['amount']['amount'])->getAmount()];
        }

        return [null, 0.0];
    }

    private function percentageToShopifyRatio(mixed $percentage): float
    {
        $cents = min(10000, max(0, Money::of($percentage ?? 0)->getCents()));

        return round($cents / 10000, 4);
    }

    private function shopifyRatioToPercentage(mixed $ratio): float
    {
        $raw = ltrim(trim((string) ($ratio ?? '0')), '+');
        $parts = explode('.', $raw);
        $whole = (int) ($parts[0] ?? 0);
        $fraction = str_pad(substr($parts[1] ?? '', 0, 4), 4, '0');
        $cents = ($whole * 10000) + (int) $fraction;

        return Money::fromCents($cents)->getAmount();
    }

    private function handleDeletedDiscount(int $accountId, string $gid): void
    {
        if (EcommerceSyncEchoGuard::matchesAndConsumeEcho(EcommercePlatform::SHOPIFY, 'discount_delete', $accountId, $gid, 'deleted')) {
            return;
        }
        Promotion::withoutGlobalScopes()->where('user_id', $accountId)->where('shopify_discount_id', $gid)->delete();
    }

    private function isOutgoingCouponEcho(int $accountId, string $gid, string $code, string $discountType, float $discountValue, bool $isActive): bool
    {
        if (EcommerceSyncEchoGuard::matchesAndConsumeEcho(EcommercePlatform::SHOPIFY, 'discount_gid', $accountId, $gid, 'deactivated')) {
            return true;
        }

        return EcommerceSyncEchoGuard::matchesAndConsumeEcho(
            EcommercePlatform::SHOPIFY,
            'coupon',
            $accountId,
            $code,
            EcommerceSyncEchoGuard::couponFingerprint($code, $discountType, $discountValue, $isActive)
        );
    }

    private function recordCouponPushEcho(int $accountId, Promotion $promotion): void
    {
        $discountType = $promotion->discount_type instanceof PromotionDiscountType ? $promotion->discount_type->value : (string) $promotion->discount_type;
        EcommerceSyncEchoGuard::recordEcho(
            EcommercePlatform::SHOPIFY,
            'coupon',
            $accountId,
            strtoupper(trim((string) $promotion->code)),
            EcommerceSyncEchoGuard::couponFingerprint((string) $promotion->code, $discountType, $promotion->discount_value, (bool) $promotion->is_active)
        );
    }

    private function recordPushSuccess(Promotion $promotion, string $gid): void
    {
        EcommerceSyncEchoGuard::suppressDuring((int) $promotion->user_id, function () use ($promotion, $gid): void {
            $promotion->update(['shopify_discount_id' => $gid ?: $promotion->shopify_discount_id, 'last_synced_at' => now(), 'sync_error' => null]);
        });
    }

    private function recordPushFailure(ShopifyIntegration $integration, Promotion $promotion, string $message): void
    {
        EcommerceSyncEchoGuard::suppressDuring((int) $promotion->user_id, function () use ($integration, $promotion, $message): void {
            $promotion->update(['sync_error' => $message]);
            $integration->update(['last_error' => $message]);
        });
    }

    private function resolvePromotionType(Promotion $promotion): ?PromotionType
    {
        return $promotion->type instanceof PromotionType ? $promotion->type : PromotionType::tryFrom((string) $promotion->type);
    }

    private function parseDate(mixed $date): ?string
    {
        return !empty($date) ? Carbon::parse((string) $date)->toDateString() : null;
    }
}
