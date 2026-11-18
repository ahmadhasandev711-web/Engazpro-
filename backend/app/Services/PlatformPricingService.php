<?php

namespace App\Services;

use App\Enums\AdminAuditAction;
use App\Models\PlatformSetting;
use App\Support\Money;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class PlatformPricingService
{
    private const CACHE_KEY = 'platform_pricing_overrides_v1';

    /**
     * Canonical pricing payload for Landing Page, Super Admin UI, and license generation.
     *
     * @return array<string, mixed>
     */
    public function getPricing(): array
    {
        $overrides = $this->readOverrides();
        $basicMonthly = Money::of($overrides['basic_monthly_price'] ?? config('pos.basic_monthly_price', 299.00));
        $basicAnnual = Money::of($overrides['basic_annual_price'] ?? config('pos.annual_subscription_price', 3000.00));
        $proMonthly = Money::of($overrides['pro_monthly_price'] ?? config('pos.pro_monthly_price', 499.00));
        $proAnnual = Money::of($overrides['pro_annual_price'] ?? config('pos.pro_annual_subscription_price', 5000.00));
        $trialDays = (int) ($overrides['trial_days'] ?? config('pos.trial_days', 14));
        $currency = (string) ($overrides['currency'] ?? config('pos.currency', 'EGP'));

        $basic = $this->buildTierBreakdown($basicMonthly, $basicAnnual);
        $pro = $this->buildTierBreakdown($proMonthly, $proAnnual);

        return array_merge($basic, [
            'trial_days' => $trialDays,
            'currency' => $currency,
            'basic' => $basic,
            'pro' => $pro,
        ]);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function updatePricing(array $data): array
    {
        $entries = [
            'basic_monthly_price' => Money::of($data['basic_monthly_price'])->getAmount(),
            'basic_annual_price' => Money::of($data['basic_annual_price'])->getAmount(),
            'pro_monthly_price' => Money::of($data['pro_monthly_price'])->getAmount(),
            'pro_annual_price' => Money::of($data['pro_annual_price'])->getAmount(),
            'trial_days' => (int) $data['trial_days'],
        ];

        DB::transaction(function () use ($entries) {
            foreach ($entries as $key => $value) {
                PlatformSetting::updateOrCreate(['key' => $key], ['value' => (string) $value]);
            }
            app(AdminAuditService::class)->record(
                AdminAuditAction::PRICING_UPDATED,
                'تحديث أسعار باقات المنصة وتجربة الاشتراك من لوحة المدير العام',
                null,
                $entries
            );
        });

        Cache::forget(self::CACHE_KEY);

        return $this->getPricing();
    }

    public function resolvePlanPrice(bool $ecommerceEnabled, int $durationDays): Money
    {
        $pricing = $this->getPricing();
        $tier = $ecommerceEnabled ? $pricing['pro'] : $pricing['basic'];

        if ($durationDays <= 45) {
            return Money::of($tier['monthly_price']);
        }
        if ($durationDays >= 330 && $durationDays <= 380) {
            return Money::of($tier['annual_price']);
        }

        $months = max(1, (int) round($durationDays / 30));

        return Money::of($tier['annual_price'])->multiply($months)->divide(12);
    }

    /**
     * @return array{annual_price: float, monthly_price: float, yearly_monthly_equivalent: float, annual_savings: float}
     */
    private function buildTierBreakdown(Money $monthly, Money $annual): array
    {
        $savings = $monthly->multiply(12)->subtract($annual);
        if ($savings->isNegative()) {
            $savings = Money::zero();
        }

        return [
            'annual_price' => $annual->getAmount(),
            'monthly_price' => $monthly->getAmount(),
            'yearly_monthly_equivalent' => $annual->divide(12)->getAmount(),
            'annual_savings' => $savings->getAmount(),
        ];
    }

    /**
     * @return array<string, string|null>
     */
    private function readOverrides(): array
    {
        if (!Schema::hasTable('platform_settings')) {
            return [];
        }

        return Cache::remember(self::CACHE_KEY, 300, fn () => PlatformSetting::pluck('value', 'key')->all());
    }
}
