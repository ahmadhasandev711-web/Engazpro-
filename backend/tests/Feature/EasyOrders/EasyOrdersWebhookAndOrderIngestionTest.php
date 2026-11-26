<?php

namespace Tests\Feature\EasyOrders;

use App\Contracts\EasyOrdersApiClientInterface;
use App\Enums\EasyOrdersAuthMode;
use App\Enums\EcommercePlatform;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\EasyOrdersIntegration;
use App\Models\OnlineOrder;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class EasyOrdersWebhookAndOrderIngestionTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Branch $branch;
    private EasyOrdersIntegration $integration;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => UserRole::OWNER->value, 'ecommerce_enabled' => true]);
        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value,
            'plan' => 'PRO',
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'المخزن الرئيسي',
            'code' => 'MAIN-01',
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->integration = EasyOrdersIntegration::create([
            'user_id' => $this->owner->id,
            'store_id' => '29bafd4f-5e5a-4faf-8f0f-6c4379eb65ef',
            'store_name' => 'EasyStore Egypt',
            'auth_mode' => EasyOrdersAuthMode::API_KEY->value,
            'api_key' => 'eo-secret-api-key',
            'webhook_secret' => 'wh-secret-12345',
            'default_branch_id' => $this->branch->id,
            'auto_sync_stock' => true,
            'is_active' => true,
        ]);
    }

    public function test_rejects_webhook_with_invalid_or_missing_secret(): void
    {
        $res = $this->postJson("/api/webhooks/easyorders/{$this->owner->id}/orders", [
            'id' => '2692e31f-27f6-472d-b4cd-c0c1c168511c',
            'total_cost' => 750,
        ], ['secret' => 'wrong-secret']);

        $res->assertStatus(401);
        $this->assertDatabaseCount('online_orders', 0);
    }

    public function test_ingests_valid_order_webhook_and_reserves_branch_stock_with_idempotency(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'هودي قطن أوفر سايز',
            'code' => 'EO-HD-01',
            'barcode' => '622000111',
            'purchase_price' => 350,
            'regular_price' => 750,
            'sale_price' => 730,
            'quantity' => 10,
            'unit' => 'قطعة',
            'easyorders_product_id' => 'fac7a724-63bd-42c8-8179-9e96f992504f',
            'easyorders_sku' => 'EO-HD-01',
        ]);
        BranchStock::create([
            'user_id' => $this->owner->id,
            'branch_id' => $this->branch->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        Http::fake(); // Prevent real outbound stock sync calls

        $payload = [
            'id' => '2692e31f-27f6-472d-b4cd-c0c1c168511c',
            'short_id' => 412,
            'created_at' => '2026-11-22T12:00:00+02:00',
            'cost' => 1460,
            'shipping_cost' => 60,
            'total_cost' => 1420, // discount of 100 deduced accurately via Money
            'status' => 'pending',
            'full_name' => 'سارة محمود',
            'phone' => '+201012345678',
            'government' => 'القاهرة',
            'address' => '12 شارع مكرم عبيد، مدينة نصر',
            'payment_method' => 'cod',
            'cart_items' => [
                [
                    'id' => '27845040-1252-448a-a257-1118e9ff2424',
                    'product_id' => 'fac7a724-63bd-42c8-8179-9e96f992504f',
                    'price' => 730,
                    'quantity' => 2,
                    'product' => [
                        'id' => 'fac7a724-63bd-42c8-8179-9e96f992504f',
                        'name' => 'هودي قطن أوفر سايز',
                        'sku' => 'EO-HD-01',
                        'price' => 730,
                    ],
                ],
            ],
        ];

        $res1 = $this->postJson("/api/webhooks/easyorders/{$this->owner->id}/orders", $payload, ['secret' => 'wh-secret-12345']);
        $res1->assertStatus(202);

        $order = OnlineOrder::where('user_id', $this->owner->id)->first();
        $this->assertNotNull($order);
        $this->assertEquals(EcommercePlatform::EASYORDERS, $order->platform);
        $this->assertEquals('2692e31f-27f6-472d-b4cd-c0c1c168511c', $order->external_order_id);
        $this->assertEquals('#412', $order->external_order_number);
        $this->assertEquals(WcPaymentStatus::PENDING_COD, $order->payment_status);
        $this->assertEquals('1460.00', $order->subtotal);
        $this->assertEquals('100.00', $order->discount_total);
        $this->assertEquals('1420.00', $order->total);

        // Duplicate delivery is safely ignored
        $res2 = $this->postJson("/api/webhooks/easyorders/{$this->owner->id}/orders", $payload, ['secret' => 'wh-secret-12345']);
        $res2->assertStatus(200);
        $this->assertDatabaseCount('online_orders', 1);
    }

    public function test_handles_order_status_update_cancellation_and_one_click_install_callback(): void
    {
        $order = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::EASYORDERS->value,
            'external_order_id' => 'ae120355-336b-48cd-8fed-3f1600015357',
            'external_order_number' => '#501',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION->value,
            'payment_status' => WcPaymentStatus::PENDING_COD->value,
            'total' => 500,
        ]);

        Http::fake();
        $res = $this->postJson("/api/webhooks/easyorders/{$this->owner->id}/order-status", [
            'event_type' => 'order-status-update',
            'order_id' => 'ae120355-336b-48cd-8fed-3f1600015357',
            'old_status' => 'pending',
            'new_status' => 'canceled',
        ], ['secret' => 'wh-secret-12345']);
        $res->assertStatus(202);
        $this->assertEquals(WcOrderStatus::CANCELLED, $order->fresh()->status);

        // Verify One-Click Install Callback
        $stateToken = 'test-install-state-token';
        Cache::put("easyorders_install_state:{$stateToken}", ['account_id' => $this->owner->id], 300);

        $cbRes = $this->postJson("/api/webhooks/easyorders/install-callback/{$stateToken}", [
            'api_key' => 'new-generated-eo-key-999',
            'store_id' => 'store-uuid-999',
            'store_name' => 'Lova Official Store',
            'secret' => 'auto-webhook-secret-999',
        ]);
        $cbRes->assertOk()->assertJsonPath('success', true);
        $freshInt = $this->integration->fresh();
        $this->assertEquals(EasyOrdersAuthMode::AUTHORIZED_APP, $freshInt->auth_mode);
        $this->assertEquals('new-generated-eo-key-999', $freshInt->api_key);
        $this->assertEquals('store-uuid-999', $freshInt->store_id);
        $this->assertNotNull($freshInt->webhook_registered_at);
    }
}
