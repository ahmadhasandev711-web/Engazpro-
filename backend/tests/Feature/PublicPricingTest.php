<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\ActivationCode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicPricingTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_pricing_returns_configured_two_tier_money_values_without_authentication(): void
    {
        config()->set('pos.basic_monthly_price', 299.00);
        config()->set('pos.annual_subscription_price', 3000.00);
        config()->set('pos.pro_monthly_price', 499.00);
        config()->set('pos.pro_annual_subscription_price', 5000.00);
        config()->set('pos.trial_days', 14);
        config()->set('pos.currency', 'EGP');

        $response = $this->getJson('/api/public/pricing');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'annual_price' => 3000.0,
                    'monthly_price' => 299.0,
                    'yearly_monthly_equivalent' => 250.0,
                    'annual_savings' => 588.0,
                    'trial_days' => 14,
                    'currency' => 'EGP',
                    'basic' => [
                        'monthly_price' => 299.0,
                        'annual_price' => 3000.0,
                    ],
                    'pro' => [
                        'monthly_price' => 499.0,
                        'annual_price' => 5000.0,
                        'annual_savings' => 988.0,
                    ],
                ],
            ]);
    }

    public function test_super_admin_pricing_drives_public_landing_and_license_generation(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);

        $this->actingAs($admin)->putJson('/api/admin/pricing', [
            'basic_monthly_price' => 350,
            'basic_annual_price' => 3600,
            'pro_monthly_price' => 550,
            'pro_annual_price' => 5400,
            'trial_days' => 21,
        ])->assertOk()
            ->assertJsonPath('data.basic.monthly_price', 350)
            ->assertJsonPath('data.pro.annual_price', 5400);

        $this->getJson('/api/public/pricing')
            ->assertOk()
            ->assertJsonPath('data.basic.monthly_price', 350)
            ->assertJsonPath('data.pro.annual_price', 5400)
            ->assertJsonPath('data.trial_days', 21);

        $this->actingAs($admin)->postJson('/api/admin/licenses/generate', [
            'count' => 1,
            'duration_days' => 30,
            'ecommerce_enabled' => true,
        ])->assertCreated();

        $code = ActivationCode::latest('id')->firstOrFail();
        $this->assertSame(550.0, (float) $code->price);
    }
}
