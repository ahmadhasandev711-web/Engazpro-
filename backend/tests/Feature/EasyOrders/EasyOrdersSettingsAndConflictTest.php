<?php

namespace Tests\Feature\EasyOrders;

use App\Enums\EcommercePlatform;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\EasyOrdersIntegration;
use App\Models\ShopifyIntegration;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class EasyOrdersSettingsAndConflictTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $admin;
    private Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => UserRole::OWNER->value, 'ecommerce_enabled' => true]);
        $this->admin = User::factory()->create(['role' => UserRole::OWNER->value, 'is_admin' => true, 'ecommerce_enabled' => true]);
        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value,
            'plan' => 'PRO',
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'BR-01',
            'is_main' => true,
            'is_active' => true,
        ]);
    }

    public function test_saves_and_encrypts_credentials_and_builds_install_link(): void
    {
        $res = $this->actingAs($this->owner)->postJson('/api/easyorders/settings', [
            'store_name' => 'براند إيزي أوردر',
            'api_key' => 'eo-live-key-secret-123',
            'default_branch_id' => $this->branch->id,
            'auto_sync_stock' => true,
            'is_active' => true,
        ]);

        $res->assertOk()
            ->assertJsonPath('data.is_active', true)
            ->assertJsonPath('data.has_api_key', true)
            ->assertJsonMissing(['api_key' => 'eo-live-key-secret-123']);

        $integration = EasyOrdersIntegration::where('user_id', $this->owner->id)->firstOrFail();
        $this->assertEquals('eo-live-key-secret-123', $integration->api_key);
        $this->assertNotEquals('eo-live-key-secret-123', $integration->getRawOriginal('api_key'));

        $linkRes = $this->actingAs($this->owner)->getJson('/api/easyorders/install-link');
        $linkRes->assertOk();
        $url = $linkRes->json('data.install_url');
        $this->assertStringContainsString('https://app.easy-orders.net/#/install-app', $url);
        $this->assertStringContainsString('orders_webhook=', $url);
        $this->assertStringContainsString('order_status_webhook=', $url);
    }

    public function test_enforces_mutual_exclusion_with_shopify_and_woocommerce(): void
    {
        ShopifyIntegration::create([
            'user_id' => $this->owner->id,
            'shop_domain' => 'demo.myshopify.com',
            'access_token' => 'shpat_123',
            'is_active' => true,
        ]);

        $res = $this->actingAs($this->owner)->postJson('/api/easyorders/settings', [
            'api_key' => 'eo-key-conflict',
            'is_active' => true,
        ]);

        $res->assertStatus(422)->assertJsonPath('error_code', 'ECOMMERCE_PLATFORM_CONFLICT');
    }

    public function test_super_admin_can_configure_test_and_remove_easyorders_integration(): void
    {
        $res = $this->actingAs($this->admin)->putJson("/api/admin/users/{$this->owner->id}/ecommerce/easyorders", [
            'store_name' => 'Admin Linked EO',
            'api_key' => 'eo-admin-key-777',
            'default_branch_id' => $this->branch->id,
            'auto_sync_stock' => true,
            'is_active' => true,
        ]);

        $res->assertOk()->assertJsonPath('data.is_active', true)->assertJsonPath('data.has_api_key', true);

        Http::fake([
            'https://api.easy-orders.net/api/v1/external-apps/products*' => Http::response(['data' => [], 'pageCount' => 1], 200),
        ]);
        $testRes = $this->actingAs($this->admin)->postJson("/api/admin/users/{$this->owner->id}/ecommerce/test");
        $testRes->assertOk()->assertJsonPath('data.platform', EcommercePlatform::EASYORDERS->value);

        $delRes = $this->actingAs($this->admin)->deleteJson("/api/admin/users/{$this->owner->id}/ecommerce/easyorders");
        $delRes->assertOk();
        $this->assertDatabaseMissing('easyorders_integrations', ['user_id' => $this->owner->id]);
    }
}
