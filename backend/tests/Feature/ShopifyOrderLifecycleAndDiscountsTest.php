<?php

namespace Tests\Feature;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\BranchType;
use App\Enums\PartyType;
use App\Enums\ProductType;
use App\Enums\ShopifyAuthMode;
use App\Enums\StockTransferStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Party;
use App\Models\Product;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyLocationMapping;
use App\Models\ShopifyOrder;
use App\Models\StockTransfer;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Shopify\ShopifyStockSyncGate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class ShopifyOrderLifecycleAndDiscountsTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $mandob;
    protected Branch $nasrBranch;
    protected Branch $vanBranch;
    protected Product $product;
    protected Party $courier;
    protected ShopifyIntegration $integration;

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

        $this->nasrBranch = Branch::create(['user_id' => $this->owner->id, 'name' => 'مخزن نصر', 'code' => 'BR-NASR', 'is_main' => true, 'is_active' => true]);
        $this->vanBranch = Branch::create(['user_id' => $this->owner->id, 'name' => 'سيارة المندوب', 'code' => 'BR-VAN', 'type' => BranchType::VAN->value, 'is_active' => true]);
        $this->mandob = User::factory()->create([
            'owner_id' => $this->owner->id,
            'branch_id' => $this->vanBranch->id,
            'role' => UserRole::MANDOB->value,
        ]);

        $this->courier = Party::create(['user_id' => $this->owner->id, 'type' => PartyType::COURIER->value, 'name' => 'بوسطة - Bosta']);

        $this->integration = ShopifyIntegration::create([
            'user_id' => $this->owner->id,
            'shop_domain' => 'orders-shop.myshopify.com',
            'auth_mode' => ShopifyAuthMode::ACCESS_TOKEN,
            'access_token' => 'shpat_ord',
            'webhook_secret' => 'whsec_test_123',
            'default_branch_id' => $this->nasrBranch->id,
            'auto_sync_stock' => false,
            'is_active' => true,
        ]);
        ShopifyStockSyncGate::forget($this->owner->id);

        ShopifyLocationMapping::create([
            'user_id' => $this->owner->id,
            'shopify_integration_id' => $this->integration->id,
            'shopify_location_id' => 991,
            'shopify_location_name' => 'Nasr Hub',
            'branch_id' => $this->nasrBranch->id,
            'auto_sync_stock' => false,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'هودي قطن',
            'code' => 'HOOD-1',
            'barcode' => 'HOOD-1',
            'purchase_price' => 200,
            'regular_price' => 500,
            'sale_price' => 400,
            'quantity' => 10,
            'unit' => 'قطعة',
            'type' => ProductType::STANDARD->value,
            'shopify_product_id' => 90001,
            'shopify_variant_id' => 91001,
            'shopify_inventory_item_id' => 92001,
        ]);
        BranchStock::create(['branch_id' => $this->nasrBranch->id, 'product_id' => $this->product->id, 'quantity' => 10]);
    }

    public function test_webhook_hmac_verification_ingests_order_with_coupons_and_location_branch(): void
    {
        $payload = json_encode([
            'id' => 6001001,
            'name' => '#1045',
            'created_at' => '2026-11-16T12:00:00Z',
            'financial_status' => 'pending',
            'payment_gateway_names' => ['Cash on Delivery (COD)'],
            'location_id' => 991,
            'current_total_price' => '770.00',
            'current_total_tax' => '0.00',
            'discount_codes' => [['code' => 'RAMADAN80', 'amount' => '80.00']],
            'discount_applications' => [['type' => 'discount_code', 'code' => 'RAMADAN80', 'target_type' => 'line_item', 'value' => '80.00']],
            'shipping_lines' => [['title' => 'Standard', 'price' => '50.00', 'discounted_price' => '50.00']],
            'customer' => ['id' => 333444, 'first_name' => 'سارة', 'last_name' => 'محمود', 'email' => 'sara@example.com'],
            'shipping_address' => ['first_name' => 'سارة', 'last_name' => 'محمود', 'phone' => '+201012345678', 'address1' => '10 عباس العقاد', 'city' => 'مدينة نصر', 'province' => 'القاهرة'],
            'line_items' => [[
                'product_id' => 90001, 'variant_id' => 91001, 'title' => 'هودي قطن', 'sku' => 'HOOD-1',
                'quantity' => 2, 'price' => '400.00', 'compare_at_price' => '500.00',
            ]],
        ]);

        // Bad HMAC -> 401
        $this->post('/api/webhooks/shopify/' . $this->owner->id, [], [
            'HTTP_X-Shopify-Hmac-Sha256' => 'bad_sig',
            'HTTP_X-Shopify-Topic' => 'orders/create',
            'CONTENT_TYPE' => 'application/json',
        ], $payload)->assertStatus(401);

        // Valid HMAC -> 202 and ingested synchronously on queue=sync
        $hmac = base64_encode(hash_hmac('sha256', $payload, 'whsec_test_123', true));
        $this->call('POST', '/api/webhooks/shopify/' . $this->owner->id, [], [], [], [
            'HTTP_X-Shopify-Hmac-Sha256' => $hmac,
            'HTTP_X-Shopify-Topic' => 'orders/create',
            'CONTENT_TYPE' => 'application/json',
        ], $payload)->assertStatus(202);

        $order = ShopifyOrder::where('shopify_order_id', 6001001)->firstOrFail();
        $this->assertSame('#1045', $order->shopify_order_number);
        $this->assertSame($this->nasrBranch->id, $order->branch_id);
        $this->assertSame(['RAMADAN80'], $order->coupon_codes);
        $this->assertSame(800.0, (float) $order->subtotal);
        $this->assertSame(50.0, (float) $order->shipping_cost);
        $this->assertSame(80.0, (float) $order->discount_total);
        $this->assertSame(770.0, (float) $order->total); // 800 + 50 - 80
        $this->assertSame(WcPaymentStatus::PENDING_COD, $order->payment_status);
    }

    public function test_full_mandob_lifecycle_creates_van_transfer_invoice_and_pushes_fulfillment(): void
    {
        $mock = Mockery::mock(ShopifyGraphqlClientInterface::class);
        $mock->shouldReceive('getOrderFulfillmentOrders')->once()->andReturn([[
            'id' => 'gid://shopify/FulfillmentOrder/555',
            'status' => 'OPEN',
            'lineItems' => ['edges' => [['node' => ['id' => 'gid://shopify/FulfillmentOrderLineItem/777', 'remainingQuantity' => 2]]]],
        ]]);
        $mock->shouldReceive('createFulfillment')->once()->withArgs(function ($int, $input) {
            return $input['lineItemsByFulfillmentOrder'][0]['fulfillmentOrderId'] === 'gid://shopify/FulfillmentOrder/555';
        })->andReturn(['fulfillment' => ['id' => 'gid://shopify/Fulfillment/888', 'status' => 'SUCCESS']]);
        $this->app->instance(ShopifyGraphqlClientInterface::class, $mock);

        $order = ShopifyOrder::create([
            'user_id' => $this->owner->id,
            'shopify_order_id' => 6002002,
            'shopify_order_number' => '#1050',
            'branch_id' => $this->nasrBranch->id,
            'party_id' => Party::create(['user_id' => $this->owner->id, 'type' => PartyType::CUSTOMER->value, 'name' => 'أحمد علي'])->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'subtotal' => 800,
            'discount_total' => 80,
            'shipping_cost' => 50,
            'total' => 770,
            'coupon_codes' => ['RAMADAN80'],
            'items_snapshot' => [[
                'product_id' => $this->product->id, 'shopify_product_id' => 90001, 'shopify_variant_id' => 91001,
                'name' => 'هودي قطن', 'quantity' => 2, 'price' => 400,
            ]],
        ]);
        $order->items()->create([
            'user_id' => $this->owner->id, 'product_id' => $this->product->id,
            'shopify_product_id' => 90001, 'shopify_variant_id' => 91001, 'quantity' => 2,
        ]);

        // 1. Confirm
        $this->actingAs($this->owner)->postJson("/api/shopify-orders/{$order->id}/confirm", ['branch_id' => $this->nasrBranch->id])
            ->assertOk();

        // 2. Dispatch to Mandob -> creates in-transit van transfer
        $this->actingAs($this->owner)->postJson("/api/shopify-orders/{$order->id}/dispatch", ['mandob_id' => $this->mandob->id])
            ->assertOk();
        $transfer = StockTransfer::latest('id')->firstOrFail();
        $this->assertSame(StockTransferStatus::IN_TRANSIT, $transfer->status);

        // 3. Deliver -> settles van transfer, creates invoice matching 770.00, pushes fulfillment to Shopify
        $delivRes = $this->actingAs($this->owner)->postJson("/api/shopify-orders/{$order->id}/deliver", ['collected_amount' => 770]);
        $delivRes->assertOk();

        $this->assertSame(StockTransferStatus::RECEIVED, $transfer->fresh()->status);
        $this->assertSame(WcOrderStatus::DELIVERED, $order->fresh()->status);
        $this->assertSame(770.0, (float) $order->fresh()->invoice->total);
        $this->assertSame(8, (int) $this->product->fresh()->quantity); // 10 - 2
    }

    public function test_courier_dispatch_and_cod_delivery_records_courier_ledger_debt(): void
    {
        $mock = Mockery::mock(ShopifyGraphqlClientInterface::class);
        $mock->shouldReceive('getOrderFulfillmentOrders')->once()->andReturn([]);
        $this->app->instance(ShopifyGraphqlClientInterface::class, $mock);

        $order = ShopifyOrder::create([
            'user_id' => $this->owner->id,
            'shopify_order_id' => 6003003,
            'shopify_order_number' => '#1060',
            'branch_id' => $this->nasrBranch->id,
            'party_id' => Party::create(['user_id' => $this->owner->id, 'type' => PartyType::CUSTOMER->value, 'name' => 'منى حسن'])->id,
            'status' => WcOrderStatus::CONFIRMED,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'subtotal' => 400,
            'discount_total' => 0,
            'shipping_cost' => 40,
            'total' => 440,
            'items_snapshot' => [[
                'product_id' => $this->product->id, 'shopify_product_id' => 90001, 'shopify_variant_id' => 91001,
                'name' => 'هودي قطن', 'quantity' => 1, 'price' => 400,
            ]],
        ]);
        $order->items()->create([
            'user_id' => $this->owner->id, 'product_id' => $this->product->id,
            'shopify_product_id' => 90001, 'shopify_variant_id' => 91001, 'quantity' => 1,
        ]);

        $this->actingAs($this->owner)->postJson("/api/shopify-orders/{$order->id}/dispatch-courier", [
            'courier_party_id' => $this->courier->id,
            'tracking_number' => 'BOSTA-999111',
        ])->assertOk();

        $this->actingAs($this->owner)->postJson("/api/shopify-orders/{$order->id}/deliver", ['collected_amount' => 440])
            ->assertOk();

        // Courier collected 440, shipping fee credited 40 -> net balance due from courier = 400
        $this->assertSame(400.0, (float) $this->courier->fresh()->balance);
    }
}
