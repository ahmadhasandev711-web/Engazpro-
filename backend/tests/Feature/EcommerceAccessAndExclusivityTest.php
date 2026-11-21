<?php

namespace Tests\Feature;

use App\Enums\AdminAuditAction;
use App\Enums\EcommercePlatform;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Models\AdminAuditLog;
use App\Models\ShopifyIntegration;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\Shopify\ShopifyStockSyncGate;
use App\Services\WooCommerce\WooStockSyncGate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EcommerceAccessAndExclusivityTest extends TestCase
{
    use RefreshDatabase;

    private function createSubscribedMerchant(bool $ecommerceEnabled = false): User
    {
        $owner = User::factory()->create([
            'role' => UserRole::OWNER,
            'is_admin' => false,
            'ecommerce_enabled' => $ecommerceEnabled,
        ]);

        Subscription::create([
            'user_id' => $owner->id,
            'start_date' => now()->subDay()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE,
            'plan' => 'ANNUAL',
            'price' => 3000.00,
        ]);

        return $owner->fresh();
    }

    public function test_new_merchant_has_ecommerce_disabled_by_default_and_is_blocked_from_all_ecommerce_routes(): void
    {
        $owner = $this->createSubscribedMerchant(false);

        $meRes = $this->actingAs($owner)->getJson('/api/auth/me')->assertOk();
        $this->assertFalse($meRes->json('data.ecommerce_enabled'));
        $this->assertNull($meRes->json('data.active_ecommerce_platform'));

        $this->actingAs($owner)->getJson('/api/woocommerce/settings')
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'ECOMMERCE_ADDON_DISABLED');

        $this->actingAs($owner)->getJson('/api/online-orders')
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'ECOMMERCE_ADDON_DISABLED');

        $this->actingAs($owner)->getJson('/api/shopify/settings')
            ->assertStatus(403)
            ->assertJsonPath('error_code', 'ECOMMERCE_ADDON_DISABLED');
    }

    public function test_super_admin_can_toggle_ecommerce_addon_and_stops_sync_gates_and_webhooks(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'role' => UserRole::ADMIN]);
        $owner = $this->createSubscribedMerchant(false);

        $this->actingAs($owner)->postJson("/api/admin/users/{$owner->id}/toggle-ecommerce")
            ->assertStatus(403);

        // Enable addon
        $enableRes = $this->actingAs($admin)->postJson("/api/admin/users/{$owner->id}/toggle-ecommerce")
            ->assertOk();
        $this->assertTrue($enableRes->json('data.ecommerce_enabled'));

        $this->actingAs($owner->fresh())->getJson('/api/woocommerce/settings')->assertOk();

        // Create active WC integration and verify stock gate & webhook gate follow addon toggle
        WooCommerceIntegration::create([
            'user_id' => $owner->id,
            'store_url' => 'https://example-shop.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'webhook_secret' => 'wh_secret_123',
            'is_active' => true,
            'auto_sync_stock' => true,
        ]);

        WooStockSyncGate::forget($owner->id);
        $this->assertTrue(WooStockSyncGate::isActive($owner->id));

        // Disable addon -> blocks routes, webhook, and stock sync gate immediately
        $disableRes = $this->actingAs($admin)->postJson("/api/admin/users/{$owner->id}/toggle-ecommerce")
            ->assertOk();
        $this->assertFalse($disableRes->json('data.ecommerce_enabled'));
        $this->assertFalse(WooStockSyncGate::isActive($owner->id));

        $this->actingAs($owner->fresh())->getJson('/api/online-orders')->assertStatus(403);

        $payload = json_encode(['webhook_id' => 1]);
        $sig = base64_encode(hash_hmac('sha256', $payload, 'wh_secret_123', true));
        $this->postJson("/api/webhooks/woocommerce/{$owner->id}", ['webhook_id' => 1], [
            'X-WC-Webhook-Signature' => $sig,
            'X-WC-Webhook-Topic' => 'order.created',
        ])->assertStatus(403);

        $this->assertDatabaseHas('admin_audit_logs', [
            'target_user_id' => $owner->id,
            'action' => AdminAuditAction::STORE_ECOMMERCE_TOGGLED->value,
        ]);
        $this->assertSame(2, AdminAuditLog::where('action', AdminAuditAction::STORE_ECOMMERCE_TOGGLED->value)->count());
    }

    public function test_activation_code_with_ecommerce_enabled_grants_addon_access(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'role' => UserRole::ADMIN]);
        $owner = $this->createSubscribedMerchant(false);

        $genRes = $this->actingAs($admin)->postJson('/api/admin/licenses/generate', [
            'count' => 1,
            'duration_days' => 365,
            'price' => 5000,
            'ecommerce_enabled' => true,
            'notes' => 'باقة 5000 مع المتجر الإلكتروني',
        ])->assertStatus(201);

        $code = $genRes->json('data.0.code');
        $this->assertTrue($genRes->json('data.0.ecommerce_enabled'));

        $this->actingAs($owner)->postJson('/api/subscription/activate-code', ['code' => $code])
            ->assertOk();

        $meRes = $this->actingAs($owner->fresh())->getJson('/api/auth/me')->assertOk();
        $this->assertTrue($meRes->json('data.ecommerce_enabled'));
    }

    public function test_merchant_cannot_enable_both_woocommerce_and_shopify_simultaneously(): void
    {
        $owner = $this->createSubscribedMerchant(true);

        // 1. Activate WooCommerce first
        $this->actingAs($owner)->postJson('/api/woocommerce/settings', [
            'store_url' => 'https://wc.example.com',
            'consumer_key' => 'ck_123',
            'consumer_secret' => 'cs_123',
            'is_active' => true,
        ])->assertOk();

        $this->actingAs($owner)->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.active_ecommerce_platform', EcommercePlatform::WOOCOMMERCE->value);

        // 2. Trying to activate Shopify or initiate OAuth while WC is active must fail (422)
        $this->actingAs($owner)->postJson('/api/shopify/settings', [
            'shop_domain' => 'demo-store.myshopify.com',
            'access_token' => 'shpat_123',
            'is_active' => true,
        ])->assertStatus(422)
            ->assertJsonPath('error_code', 'ECOMMERCE_PLATFORM_CONFLICT');

        $this->actingAs($owner)->getJson('/api/shopify/authorize-url?shop_domain=demo-store.myshopify.com')
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'ECOMMERCE_PLATFORM_CONFLICT');

        // 3. Deactivate WooCommerce, then Shopify activation succeeds
        $this->actingAs($owner)->postJson('/api/woocommerce/settings', [
            'store_url' => 'https://wc.example.com',
            'is_active' => false,
        ])->assertOk();

        $this->actingAs($owner)->postJson('/api/shopify/settings', [
            'shop_domain' => 'demo-store.myshopify.com',
            'access_token' => 'shpat_123',
            'is_active' => true,
        ])->assertOk();

        $this->actingAs($owner)->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('data.active_ecommerce_platform', EcommercePlatform::SHOPIFY->value);

        // 4. Now WooCommerce cannot be re-activated until Shopify is deactivated
        $this->actingAs($owner)->postJson('/api/woocommerce/settings', [
            'store_url' => 'https://wc.example.com',
            'is_active' => true,
        ])->assertStatus(422)
            ->assertJsonPath('error_code', 'ECOMMERCE_PLATFORM_CONFLICT');

        $this->actingAs($owner)->getJson('/api/woocommerce/authorize-url?store_url=https://wc.example.com')
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'ECOMMERCE_PLATFORM_CONFLICT');
    }

    public function test_admin_users_list_includes_ecommerce_addon_and_active_platform_flags(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'role' => UserRole::ADMIN]);
        $owner = $this->createSubscribedMerchant(true);
        ShopifyIntegration::create([
            'user_id' => $owner->id,
            'shop_domain' => 'store.myshopify.com',
            'access_token' => 'shpat_abc',
            'is_active' => true,
        ]);

        ShopifyStockSyncGate::forget($owner->id);
        $this->assertTrue(ShopifyStockSyncGate::isActive($owner->id));

        $res = $this->actingAs($admin)->getJson('/api/admin/users?search=' . urlencode($owner->phone))
            ->assertOk();

        $row = collect($res->json('data.data'))->firstWhere('id', $owner->id);
        $this->assertNotNull($row);
        $this->assertTrue((bool) $row['ecommerce_enabled']);
        $this->assertSame(EcommercePlatform::SHOPIFY->value, $row['active_ecommerce_platform']);
    }

    public function test_trial_ecommerce_access_turns_off_on_basic_code_and_reenables_on_pro_code(): void
    {
        $admin = User::factory()->create(['is_admin' => true, 'role' => UserRole::ADMIN]);

        $regRes = $this->postJson('/api/auth/register', [
            'store_code' => 'trial-fashion',
            'name' => 'تاجر تجربة متكاملة',
            'phone' => '01091919191',
            'email' => 'trial.merchant@example.com',
            'password' => 'secret123',
        ])->assertStatus(201);

        $owner = User::where('phone', '01091919191')->firstOrFail();
        $this->assertTrue((bool) $regRes->json('data.user.ecommerce_enabled'));

        WooCommerceIntegration::create([
            'user_id' => $owner->id,
            'store_url' => 'https://trial-wc.example.com',
            'consumer_key' => 'ck_trial',
            'consumer_secret' => 'cs_trial',
            'webhook_secret' => 'wh_trial_123',
            'is_active' => true,
            'auto_sync_stock' => true,
        ]);

        WooStockSyncGate::forget($owner->id);
        $this->assertTrue(WooStockSyncGate::isActive($owner->id));

        $basicGen = $this->actingAs($admin)->postJson('/api/admin/licenses/generate', [
            'count' => 1, 'duration_days' => 30, 'price' => 399, 'ecommerce_enabled' => false,
        ])->assertStatus(201);
        $this->actingAs($owner)->postJson('/api/subscription/activate-code', [
            'code' => $basicGen->json('data.0.code'),
        ])->assertOk();

        $this->assertFalse((bool) $owner->fresh()->ecommerce_enabled);
        $this->assertFalse(WooStockSyncGate::isActive($owner->id));
        $this->actingAs($owner->fresh())->getJson('/api/online-orders')->assertStatus(403);

        $proGen = $this->actingAs($admin)->postJson('/api/admin/licenses/generate', [
            'count' => 1, 'duration_days' => 30, 'price' => 749, 'ecommerce_enabled' => true,
        ])->assertStatus(201);
        $this->actingAs($owner->fresh())->postJson('/api/subscription/activate-code', [
            'code' => $proGen->json('data.0.code'),
        ])->assertOk();

        $this->assertTrue((bool) $owner->fresh()->ecommerce_enabled);
        $this->assertTrue(WooStockSyncGate::isActive($owner->id));
        $this->actingAs($owner->fresh())->getJson('/api/online-orders')->assertOk();
    }

    public function test_expired_subscription_blocks_webhooks_and_stock_sync_gates_even_with_ecommerce_enabled(): void
    {
        $owner = $this->createSubscribedMerchant(true);

        WooCommerceIntegration::create([
            'user_id' => $owner->id,
            'store_url' => 'https://exp-wc.example.com',
            'consumer_key' => 'ck_exp',
            'consumer_secret' => 'cs_exp',
            'webhook_secret' => 'wh_exp_wc',
            'is_active' => true,
            'auto_sync_stock' => true,
        ]);

        WooStockSyncGate::forget($owner->id);
        $this->assertTrue(WooStockSyncGate::isActive($owner->id));

        $owner->subscription->update([
            'status' => SubscriptionStatus::EXPIRED,
            'end_date' => now()->subDays(5)->toDateString(),
        ]);

        $this->assertFalse(WooStockSyncGate::isActive($owner->id));

        $wcPayload = json_encode(['id' => 999]);
        $wcSig = base64_encode(hash_hmac('sha256', $wcPayload, 'wh_exp_wc', true));
        $this->call('POST', "/api/webhooks/woocommerce/{$owner->id}", [], [], [], [
            'HTTP_X-WC-Webhook-Signature' => $wcSig,
            'HTTP_X-WC-Webhook-Topic' => 'order.created',
            'CONTENT_TYPE' => 'application/json',
        ], $wcPayload)->assertStatus(403);

        ShopifyIntegration::create([
            'user_id' => $owner->id,
            'shop_domain' => 'exp-shop.myshopify.com',
            'access_token' => 'shpat_exp',
            'webhook_secret' => 'wh_exp_shopify',
            'is_active' => true,
            'auto_sync_stock' => true,
        ]);
        ShopifyStockSyncGate::forget($owner->id);
        $this->assertFalse(ShopifyStockSyncGate::isActive($owner->id));

        $shPayload = json_encode(['id' => 888]);
        $shSig = base64_encode(hash_hmac('sha256', $shPayload, 'wh_exp_shopify', true));
        $this->call('POST', "/api/webhooks/shopify/{$owner->id}", [], [], [], [
            'HTTP_X-Shopify-Hmac-Sha256' => $shSig,
            'HTTP_X-Shopify-Topic' => 'orders/create',
            'HTTP_X-Shopify-Shop-Domain' => 'exp-shop.myshopify.com',
            'CONTENT_TYPE' => 'application/json',
        ], $shPayload)->assertStatus(403);
    }
}
