<?php

namespace App\Services;

use App\Enums\PromotionDiscountType;
use App\Enums\PromotionSyncSource;
use App\Enums\PromotionType;
use App\Exceptions\PosDomainException;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\User;
use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class PromotionEngineService
{
    public function listForUser(User $user): Collection
    {
        $query = Promotion::where('user_id', $user->getAccountId())
            ->with(['branch:id,name', 'category:id,name', 'product:id,name'])
            ->latest();

        if (!$user->hasGlobalBranchAccess() && $user->branch_id !== null) {
            $query->where(fn (Builder $q) => $q->whereNull('branch_id')->orWhere('branch_id', $user->branch_id));
        }

        return $query->get();
    }

    public function createPromotion(User $user, array $data): Promotion
    {
        $payload = $this->normalizePayload($user, $data);
        if (!empty($payload['code'])) {
            $this->assertUniqueCode($user->getAccountId(), $payload['code']);
        }

        $promo = Promotion::create([
            'user_id' => $user->getAccountId(),
            'sync_source' => PromotionSyncSource::LOCAL->value,
            ...$payload,
        ]);

        app(EcommerceCatalogSyncDispatcher::class)->dispatchPromotionPush($promo);

        return $promo->load(['branch:id,name', 'category:id,name', 'product:id,name']);
    }

    public function updatePromotion(User $user, Promotion $promotion, array $data): Promotion
    {
        $payload = $this->normalizePayload($user, $data);
        if (!empty($payload['code'])) {
            $this->assertUniqueCode($user->getAccountId(), $payload['code'], $promotion->id);
        }

        $promotion->update($payload);
        $fresh = $promotion->fresh(['branch:id,name', 'category:id,name', 'product:id,name']);
        app(EcommerceCatalogSyncDispatcher::class)->dispatchPromotionPush($fresh);

        return $fresh;
    }

    public function findOrFail(int $id): Promotion
    {
        return Promotion::findOrFail($id);
    }

    public function deletePromotion(Promotion $promotion): void
    {
        $accountId = (int) $promotion->user_id;
        $promoId = (int) $promotion->id;
        $wcCouponId = $promotion->wc_coupon_id ? (int) $promotion->wc_coupon_id : null;
        $shopifyDiscountId = $promotion->shopify_discount_id ? (string) $promotion->shopify_discount_id : null;
        $syncToEcommerce = (bool) ($promotion->sync_to_ecommerce ?? true);

        $promotion->delete();

        app(EcommerceCatalogSyncDispatcher::class)->dispatchPromotionDelete(
            $accountId,
            $promoId,
            $wcCouponId,
            $shopifyDiscountId,
            $syncToEcommerce
        );
    }

    public function evaluateCart(
        User $user,
        array $items,
        ?string $couponCode = null,
        ?int $branchId = null,
        bool $throwOnInvalidCoupon = false
    ): array {
        $accountId = $user->getAccountId();
        $effectiveBranchId = app(BranchScopeService::class)->resolveQueryBranchId($user, $branchId);
        $productsMap = $this->loadProductsMap($accountId, $items);

        $cleanCode = strtoupper(trim((string) ($couponCode ?? '')));
        if ($cleanCode !== '') {
            return $this->evaluateCoupon($accountId, $items, $productsMap, $cleanCode, $effectiveBranchId, $throwOnInvalidCoupon);
        }

        return $this->findBestAutoPromotion($accountId, $items, $productsMap, $effectiveBranchId);
    }

    private function evaluateCoupon(
        int $accountId,
        array $items,
        Collection $productsMap,
        string $code,
        ?int $branchId,
        bool $throwOnInvalid
    ): array {
        $promo = $this->activeBaseQuery($accountId, $branchId)
            ->where('type', PromotionType::COUPON->value)
            ->where('code', $code)
            ->first();

        if (!$promo) {
            if ($throwOnInvalid) {
                throw new PosDomainException("كود الخصم '{$code}' غير صالح أو منتهي الصلاحية أو غير متاح لهذا الفرع.", 'INVALID_PROMOTION_CODE', 422);
            }

            return $this->emptyEvaluation();
        }

        return $this->evaluateSinglePromotion($promo, $items, $productsMap, $throwOnInvalid);
    }

    private function evaluateSinglePromotion(Promotion $promo, array $items, Collection $productsMap, bool $throwOnInvalid): array
    {
        if (!$this->isWithinDateAndUsage($promo, now()->toDateString())) {
            if ($throwOnInvalid) {
                throw new PosDomainException('انتهت صلاحية الكوبون أو بلغ الحد الأقصى للاستخدام.', 'INVALID_PROMOTION_CODE', 422);
            }

            return $this->emptyEvaluation();
        }

        $subtotalMoney = $this->sumItemsMoney($items);
        if ($subtotalMoney->isLessThan(Money::of($promo->min_order_amount ?? 0))) {
            if ($throwOnInvalid) {
                throw new PosDomainException("الحد الأدنى لتطبيق العرض هو {$promo->min_order_amount}.", 'PROMOTION_MIN_ORDER_NOT_MET', 422);
            }

            return $this->emptyEvaluation();
        }

        $discountMoney = $this->computePromotionDiscount($promo, $items, $productsMap);

        return $discountMoney->isPositive() ? $this->formatEvaluation($promo, $discountMoney) : $this->emptyEvaluation();
    }

    private function findBestAutoPromotion(int $accountId, array $items, Collection $productsMap, ?int $branchId): array
    {
        $today = now()->toDateString();
        $subtotalMoney = $this->sumItemsMoney($items);
        $promos = $this->activeBaseQuery($accountId, $branchId)
            ->whereIn('type', [PromotionType::BUY_X_GET_Y->value, PromotionType::CART_AUTO->value])
            ->get();

        $best = $this->emptyEvaluation();
        foreach ($promos as $promo) {
            if (!$this->isEligibleAutoPromo($promo, $today, $subtotalMoney)) {
                continue;
            }
            $discountMoney = $this->computePromotionDiscount($promo, $items, $productsMap);
            if ($discountMoney->isGreaterThan($best['promotion_discount_money'])) {
                $best = $this->formatEvaluation($promo, $discountMoney);
            }
        }

        return $best;
    }

    private function isEligibleAutoPromo(Promotion $promo, string $today, Money $subtotalMoney): bool
    {
        return $this->isWithinDateAndUsage($promo, $today)
            && !$subtotalMoney->isLessThan(Money::of($promo->min_order_amount ?? 0));
    }

    private function computePromotionDiscount(Promotion $promo, array $items, Collection $productsMap): Money
    {
        $eligible = $this->filterEligibleItems($promo, $items, $productsMap);
        if (empty($eligible)) {
            return Money::zero();
        }

        $rawDiscount = $promo->type === PromotionType::BUY_X_GET_Y
            ? $this->computeBuyXGetYDiscount($promo, $eligible)
            : $this->computeStandardDiscount($promo, $this->sumItemsMoney($eligible));

        return $this->capPromotionDiscount($promo, $rawDiscount);
    }

    private function computeBuyXGetYDiscount(Promotion $promo, array $eligibleItems): Money
    {
        $buyQty = max(1, (int) ($promo->buy_quantity ?? 1));
        $getQty = max(1, (int) ($promo->get_quantity ?? 1));
        $unitPrices = $this->expandSortedUnitPrices($eligibleItems);
        $percent = min(100, Money::of($promo->discount_value ?? 100)->getAmount());
        $discount = Money::zero();

        foreach (array_chunk($unitPrices, $buyQty + $getQty) as $chunk) {
            for ($k = $buyQty; $k < count($chunk); $k++) {
                $discount = $discount->add($chunk[$k]->multiply($percent / 100));
            }
        }

        return $discount;
    }

    /**
     * @return list<Money>
     */
    private function expandSortedUnitPrices(array $eligibleItems): array
    {
        $prices = [];
        foreach ($eligibleItems as $item) {
            $count = intval(floor(Quantity::of($item['quantity'] ?? 0)->toFloat()));
            $unitMoney = Money::of($item['unit_price'] ?? 0);
            for ($i = 0; $i < $count; $i++) {
                $prices[] = $unitMoney;
            }
        }
        usort($prices, fn (Money $a, Money $b) => $b->getCents() <=> $a->getCents());

        return $prices;
    }

    private function computeStandardDiscount(Promotion $promo, Money $eligibleSubtotal): Money
    {
        if ($promo->discount_type === PromotionDiscountType::PERCENTAGE) {
            $pct = min(100, Money::of($promo->discount_value ?? 0)->getAmount());

            return $eligibleSubtotal->multiply($pct / 100);
        }

        return Money::of($promo->discount_value ?? 0);
    }

    private function capPromotionDiscount(Promotion $promo, Money $discount): Money
    {
        if ($promo->max_discount_amount !== null) {
            $cap = Money::of($promo->max_discount_amount);
            if ($discount->isGreaterThan($cap)) {
                return $cap;
            }
        }

        return $discount->isNegative() ? Money::zero() : $discount;
    }

    private function activeBaseQuery(int $accountId, ?int $branchId): Builder
    {
        return Promotion::where('user_id', $accountId)
            ->where('is_active', true)
            ->when($branchId !== null, fn (Builder $q) => $q->where(fn (Builder $b) => $b->whereNull('branch_id')->orWhere('branch_id', $branchId)))
            ->when($branchId === null, fn (Builder $q) => $q->whereNull('branch_id'));
    }

    private function isWithinDateAndUsage(Promotion $promo, string $today): bool
    {
        if ($promo->starts_at && $promo->starts_at->toDateString() > $today) {
            return false;
        }
        if ($promo->ends_at && $promo->ends_at->toDateString() < $today) {
            return false;
        }

        return $promo->max_uses === null || (int) $promo->used_count < (int) $promo->max_uses;
    }

    private function filterEligibleItems(Promotion $promo, array $items, Collection $productsMap): array
    {
        return array_values(array_filter($items, function (array $item) use ($promo, $productsMap) {
            $pid = (int) ($item['product_id'] ?? 0);
            if ($promo->product_id && $pid !== (int) $promo->product_id) {
                return false;
            }
            $product = $productsMap->get($pid);

            return !$promo->category_id || ($product && (int) $product->category_id === (int) $promo->category_id);
        }));
    }

    private function loadProductsMap(int $accountId, array $items): Collection
    {
        $ids = array_values(array_unique(array_filter(array_map(fn ($i) => (int) ($i['product_id'] ?? 0), $items))));

        return empty($ids)
            ? collect()
            : Product::where('user_id', $accountId)->whereIn('id', $ids)->get(['id', 'category_id', 'sale_price'])->keyBy('id');
    }

    private function sumItemsMoney(array $items): Money
    {
        return array_reduce(
            $items,
            fn (Money $carry, array $item) => $carry->add(Money::of($item['unit_price'] ?? 0)->multiply(Quantity::of($item['quantity'] ?? 0)->toDecimalString())),
            Money::zero()
        );
    }

    private function assertUniqueCode(int $accountId, string $code, ?int $ignoreId = null): void
    {
        $exists = Promotion::where('user_id', $accountId)
            ->where('code', $code)
            ->when($ignoreId !== null, fn (Builder $q) => $q->where('id', '!=', $ignoreId))
            ->exists();

        if ($exists) {
            throw new PosDomainException("كود الخصم '{$code}' مستخدم بالفعل في عرض آخر.", 'DUPLICATE_PROMOTION_CODE', 422);
        }
    }

    private function normalizePayload(User $user, array $data): array
    {
        $code = !empty($data['code']) ? strtoupper(trim((string) $data['code'])) : null;
        $branchId = !$user->hasGlobalBranchAccess() ? $user->branch_id : ($data['branch_id'] ?? null);

        return [
            'name' => trim((string) $data['name']), 'code' => $code, 'type' => $data['type'],
            'discount_type' => $data['discount_type'], 'discount_value' => Money::of($data['discount_value'] ?? 0)->getAmount(),
            'buy_quantity' => $data['buy_quantity'] ?? null, 'get_quantity' => $data['get_quantity'] ?? null,
            'branch_id' => $branchId ?: null, 'category_id' => $data['category_id'] ?? null,
            'product_id' => $data['product_id'] ?? null, 'min_order_amount' => Money::of($data['min_order_amount'] ?? 0)->getAmount(),
            'max_discount_amount' => isset($data['max_discount_amount']) && $data['max_discount_amount'] !== '' ? Money::of($data['max_discount_amount'])->getAmount() : null,
            'max_uses' => $data['max_uses'] ?? null, 'starts_at' => $data['starts_at'] ?? null,
            'ends_at' => $data['ends_at'] ?? null, 'is_active' => array_key_exists('is_active', $data) ? (bool) $data['is_active'] : true,
            'sync_to_ecommerce' => array_key_exists('sync_to_ecommerce', $data) ? (bool) $data['sync_to_ecommerce'] : true,
        ];
    }

    private function formatEvaluation(Promotion $promo, Money $discountMoney): array
    {
        return [
            'promotion_id' => $promo->id, 'coupon_code' => $promo->code, 'promotion_name' => $promo->name,
            'promotion_type' => $promo->type instanceof PromotionType ? $promo->type->value : (string) $promo->type,
            'promotion_discount' => $discountMoney->getAmount(), 'promotion_discount_money' => $discountMoney,
        ];
    }

    private function emptyEvaluation(): array
    {
        return [
            'promotion_id' => null, 'coupon_code' => null, 'promotion_name' => null,
            'promotion_type' => null, 'promotion_discount' => 0.0, 'promotion_discount_money' => Money::zero(),
        ];
    }
}
