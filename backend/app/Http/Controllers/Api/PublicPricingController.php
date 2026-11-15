<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\Money;
use Illuminate\Http\JsonResponse;

class PublicPricingController extends Controller
{
    /**
     * Expose public subscription pricing derived from canonical POS config.
     */
    public function __invoke(): JsonResponse
    {
        $annual = Money::of(config('pos.annual_subscription_price', 3000.00));
        $monthly = $annual->divide(10);
        $yearlyMonthlyEquivalent = $annual->divide(12);
        $savings = $monthly->multiply(12)->subtract($annual);

        return response()->json([
            'success' => true,
            'data' => [
                'annual_price' => $annual->getAmount(),
                'monthly_price' => $monthly->getAmount(),
                'yearly_monthly_equivalent' => $yearlyMonthlyEquivalent->getAmount(),
                'annual_savings' => $savings->getAmount(),
                'trial_days' => (int) config('pos.trial_days', 14),
                'currency' => (string) config('pos.currency', 'EGP'),
            ],
        ]);
    }
}
