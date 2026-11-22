<?php

namespace App\Services\Easyfy;

use App\Enums\Easyfy\EasyfyCouponType;
use App\Enums\Easyfy\EasyfyOrderStatus;
use App\Exceptions\PosDomainException;
use App\Models\Easyfy\EasyfyCoupon;
use App\Models\Easyfy\EasyfyOrder;
use App\Models\Easyfy\EasyfyProductVariant;
use App\Models\Easyfy\EasyfyShippingZone;
use App\Models\User;
use App\Support\Money;

class EasyfyPricingService
{
    public function __construct(
        private readonly EasyfySettingsService $settingsService,
        private readonly EasyfyCartService $cartService
    ) {}

    public function resolveVariantUnitPrice(EasyfyProductVariant $variant, int $quantity): Money
    {
        $tiers = $variant->relationLoaded('priceTiers')
            ? $variant->priceTiers
            : $variant->priceTiers()->orderBy('min_qty')->get();

        $matched = $tiers->filter(fn ($t) => $t->min_qty <= $quantity)->sortByDesc('min_qty')->first();

        return $matched ? Money::of($matched->unit_price) : Money::of($variant->selling_price);
    }

    public function validateCoupon(?string $rawCode, int $accountId, Money $subtotal): ?EasyfyCoupon
    {
        $code = strtoupper(trim((string) $rawCode));
        if ($code === '') {
            return null;
        }
        $coupon = EasyfyCoupon::where('code', $code)->first();
        if (!$coupon || !$coupon->is_active) {
            throw new PosDomainException('كود الخصم غير صالح أو غير مفعل.', 'INVALID_EASYFY_COUPON', 422);
        }
        $this->assertCouponConstraints($coupon, $accountId, $subtotal);

        return $coupon;
    }

    public function computeDiscount(?EasyfyCoupon $coupon, Money $subtotal, Money $shippingFee): Money
    {
        if (!$coupon) {
            return Money::zero();
        }
        if ($coupon->discount_type === EasyfyCouponType::FREE_SHIPPING) {
            return $shippingFee;
        }
        if ($coupon->discount_type === EasyfyCouponType::FIXED) {
            $val = Money::of($coupon->discount_value);

            return $val->isGreaterThan($subtotal) ? $subtotal : $val;
        }

        return $this->computePercentageDiscount($coupon, $subtotal);
    }

    public function resolveShippingFee(?EasyfyShippingZone $zone, Money $subtotal): Money
    {
        $settings = $this->settingsService->all();
        $fee = $zone ? Money::of($zone->shipping_fee) : Money::of($settings[EasyfySettingsService::KEY_DEFAULT_SHIPPING_FEE] ?? 0);
        $rawThreshold = $zone?->free_shipping_threshold ?? ($settings[EasyfySettingsService::KEY_FREE_SHIPPING_THRESHOLD] ?? null);
        if ($rawThreshold !== null && Money::of($rawThreshold)->isPositive() && !$subtotal->lessThan(Money::of($rawThreshold))) {
            return Money::zero();
        }

        return $fee;
    }

    public function buildCheckoutPreview(User $user, ?int $shippingZoneId, ?string $couponCode): array
    {
        $cart = $this->cartService->getCartWithRelations($user);
        $subtotal = $this->computeCartSubtotal($cart);
        $zone = $shippingZoneId ? EasyfyShippingZone::where('is_active', true)->find($shippingZoneId) : null;
        $shippingFee = $subtotal->isPositive() ? $this->resolveShippingFee($zone, $subtotal) : Money::zero();
        $coupon = $this->validateCoupon($couponCode ?? $cart->coupon_code, $user->getAccountId(), $subtotal);
        $discount = $this->computeDiscount($coupon, $subtotal, $shippingFee);
        $total = $subtotal->add($shippingFee)->subtract($discount);

        return [
            'subtotal' => $subtotal->getAmount(),
            'shipping_fee' => $shippingFee->getAmount(),
            'discount_amount' => $discount->getAmount(),
            'coupon_code' => $coupon?->code,
            'total_amount' => $total->isNegative() ? 0 : $total->getAmount(),
            'free_shipping_threshold' => $this->resolveThresholdAmount($zone),
        ];
    }

    private function resolveThresholdAmount(?EasyfyShippingZone $zone): ?float
    {
        $raw = $zone?->free_shipping_threshold ?? ($this->settingsService->all()[EasyfySettingsService::KEY_FREE_SHIPPING_THRESHOLD] ?? null);

        return $raw !== null ? Money::of($raw)->getAmount() : null;
    }

    private function computeCartSubtotal($cart): Money
    {
        $sum = Money::zero();
        foreach ($cart->items as $item) {
            if ($item->variant) {
                $unit = $this->resolveVariantUnitPrice($item->variant, $item->quantity);
                $sum = $sum->add($unit->multiply($item->quantity));
            }
        }

        return $sum;
    }

    private function computePercentageDiscount(EasyfyCoupon $coupon, Money $subtotal): Money
    {
        $ratio = Money::of($coupon->discount_value)->getAmount() / 100;
        $raw = $subtotal->multiply($ratio);
        if ($coupon->max_discount_amount !== null) {
            $cap = Money::of($coupon->max_discount_amount);
            if ($raw->isGreaterThan($cap)) {
                $raw = $cap;
            }
        }

        return $raw->isGreaterThan($subtotal) ? $subtotal : $raw;
    }

    private function assertCouponConstraints(EasyfyCoupon $coupon, int $accountId, Money $subtotal): void
    {
        if (($coupon->starts_at && now()->lt($coupon->starts_at)) || ($coupon->expires_at && now()->gt($coupon->expires_at))) {
            throw new PosDomainException('انتهت صلاحية كود الخصم أو لم يبدأ بعد.', 'COUPON_EXPIRED', 422);
        }
        if ($coupon->max_uses !== null && $coupon->used_count >= $coupon->max_uses) {
            throw new PosDomainException('تم استنفاد الحد الأقصى لاستخدام هذا الكوبون.', 'COUPON_LIMIT_REACHED', 422);
        }
        $minOrder = Money::of($coupon->min_order_amount ?? 0);
        if ($subtotal->lessThan($minOrder)) {
            throw new PosDomainException("الحد الأدنى لتطبيق الكوبون هو {$minOrder->getAmount()}.", 'COUPON_MIN_ORDER_NOT_MET', 422);
        }
        $this->assertPerAccountUsage($coupon, $accountId);
    }

    private function assertPerAccountUsage(EasyfyCoupon $coupon, int $accountId): void
    {
        if ($coupon->max_uses_per_account === null) {
            return;
        }
        $usedByStore = EasyfyOrder::where('account_id', $accountId)
            ->where('coupon_id', $coupon->id)
            ->where('status', '!=', EasyfyOrderStatus::CANCELLED->value)
            ->count();
        if ($usedByStore >= $coupon->max_uses_per_account) {
            throw new PosDomainException('استخدم متجركم هذا الكوبون بالحد الأقصى المسموح.', 'COUPON_ACCOUNT_LIMIT_REACHED', 422);
        }
    }
}
