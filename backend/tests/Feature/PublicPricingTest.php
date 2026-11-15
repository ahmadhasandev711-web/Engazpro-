<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class PublicPricingTest extends TestCase
{
    use DatabaseTransactions;

    public function test_public_pricing_returns_configured_money_values_without_authentication(): void
    {
        config()->set('pos.annual_subscription_price', 3000.00);
        config()->set('pos.trial_days', 14);
        config()->set('pos.currency', 'EGP');

        $response = $this->getJson('/api/public/pricing');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'annual_price' => 3000.0,
                    'monthly_price' => 300.0,
                    'yearly_monthly_equivalent' => 250.0,
                    'annual_savings' => 600.0,
                    'trial_days' => 14,
                    'currency' => 'EGP',
                ],
            ]);
    }

    public function test_public_pricing_reflects_updated_annual_price_config(): void
    {
        config()->set('pos.annual_subscription_price', 4500.00);

        $response = $this->getJson('/api/public/pricing');

        $response->assertStatus(200)
            ->assertJsonPath('data.annual_price', 4500)
            ->assertJsonPath('data.monthly_price', 450)
            ->assertJsonPath('data.yearly_monthly_equivalent', 375);
    }
}
