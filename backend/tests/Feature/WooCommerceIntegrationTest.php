<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Party;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WooCommerceIntegration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WooCommerceIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected string $token;
    protected Branch $mainBranch;
    protected Branch $onlineWarehouse;
    protected Branch $vanBranch;
    protected User $mandob;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'صاحب المتجر',
            'phone' => '01000000001',
            'password' => bcrypt('password123'),
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->mainBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'MAIN-01',
            'type' => BranchType::STORE,
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->onlineWarehouse = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'مستودع الأونلاين',
            'code' => 'WH-ONL',
            'type' => BranchType::WAREHOUSE,
            'is_main' => false,
            'is_active' => true,
        ]);

        $this->vanBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'سيارة توصيل 1',
            'code' => 'VAN-01',
            'type' => BranchType::VAN,
            'is_main' => false,
            'is_active' => true,
        ]);

        $this->mandob = User::create([
            'owner_id' => $this->owner->id,
            'name' => 'مندوب التوصيل',
            'phone' => '01000000002',
            'password' => bcrypt('password123'),
            'role' => 'MANDOB',
            'branch_id' => $this->vanBranch->id,
        ]);

        $this->owner->update(['branch_id' => $this->mainBranch->id]);
        $this->token = $this->owner->createToken('test_token')->plainTextToken;
    }

    public function test_can_save_and_retrieve_integration_settings(): void
    {
        $payload = [
            'store_url' => 'https://myfashionstore.com',
            'consumer_key' => 'ck_test_1234567890',
            'consumer_secret' => 'cs_test_0987654321',
            'online_branch_id' => $this->onlineWarehouse->id,
            'auto_sync_stock' => true,
            'is_active' => true,
        ];

        $saveResponse = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/woocommerce/settings', $payload);

        $saveResponse->assertOk()
            ->assertJsonPath('success', true);

        $this->assertDatabaseHas('woocommerce_integrations', [
            'user_id' => $this->owner->id,
            'store_url' => 'https://myfashionstore.com',
            'online_branch_id' => $this->onlineWarehouse->id,
            'auto_sync_stock' => 1,
            'is_active' => 1,
        ]);

        $getResponse = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson('/api/woocommerce/settings');

        $getResponse->assertOk()
            ->assertJsonPath('data.store_url', 'https://myfashionstore.com')
            ->assertJsonPath('data.online_branch_id', $this->onlineWarehouse->id);
    }

    public function test_can_test_woocommerce_connection_with_mock(): void
    {
        WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://myfashionstore.com',
            'consumer_key' => 'ck_test_key',
            'consumer_secret' => 'cs_test_secret',
            'online_branch_id' => $this->onlineWarehouse->id,
            'is_active' => true,
        ]);

        Http::fake([
            'https://myfashionstore.com/wp-json/wc/v3/system_status*' => Http::response(['environment' => []], 200),
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/woocommerce/test-connection');

        $response->assertOk()
            ->assertJsonPath('success', true);
    }

    public function test_import_simple_and_variable_products_from_woocommerce(): void
    {
        $integration = WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://myfashionstore.com',
            'consumer_key' => 'ck_test_key',
            'consumer_secret' => 'cs_test_secret',
            'online_branch_id' => $this->onlineWarehouse->id,
            'is_active' => true,
        ]);

        Http::fake([
            'https://myfashionstore.com/wp-json/wc/v3/products?page=1&per_page=50*' => Http::response([
                [
                    'id' => 101,
                    'name' => 'تيشيرت قطن قياسي',
                    'type' => 'simple',
                    'regular_price' => '250.00',
                    'sku' => 'TSH-SIMPLE-01',
                    'manage_stock' => true,
                    'stock_quantity' => 100, // Stock on Woo should be ignored; Kashat sets 0
                ],
                [
                    'id' => 102,
                    'name' => 'قميص أكسفورد متعدد المقاسات',
                    'type' => 'variable',
                    'regular_price' => '450.00',
                    'sku' => 'SHIRT-VAR-01',
                    'attributes' => [
                        ['name' => 'Size', 'options' => ['M', 'L']],
                        ['name' => 'Color', 'options' => ['White']],
                    ],
                ],
            ], 200),
            'https://myfashionstore.com/wp-json/wc/v3/products?page=2&per_page=50*' => Http::response([], 200),
            'https://myfashionstore.com/wp-json/wc/v3/products/102/variations*' => Http::response([
                [
                    'id' => 1021,
                    'regular_price' => '450.00',
                    'sku' => 'SHIRT-VAR-M-WHT',
                    'attributes' => [
                        ['name' => 'Size', 'option' => 'M'],
                        ['name' => 'Color', 'option' => 'White'],
                    ],
                ],
                [
                    'id' => 1022,
                    'regular_price' => '470.00',
                    'sku' => 'SHIRT-VAR-L-WHT',
                    'attributes' => [
                        ['name' => 'Size', 'option' => 'L'],
                        ['name' => 'Color', 'option' => 'White'],
                    ],
                ],
            ], 200),
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/woocommerce/import-products');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.imported', 2);

        // Verify simple product in Kashat database
        $simpleProduct = Product::where('user_id', $this->owner->id)->where('wc_product_id', 101)->first();
        $this->assertNotNull($simpleProduct);
        $this->assertEquals('تيشيرت قطن قياسي', $simpleProduct->name);
        $this->assertEquals(250.00, (float) $simpleProduct->sale_price);
        $this->assertEquals(0, (float) $simpleProduct->quantity, 'Initial stock must be 0 because Kashat is master');

        // Verify variable product and variants
        $varProduct = Product::where('user_id', $this->owner->id)->where('wc_product_id', 102)->first();
        $this->assertNotNull($varProduct);
        $this->assertEquals('VARIABLE', $varProduct->type);
        $this->assertEquals(2, $varProduct->variants()->count());

        $v1 = $varProduct->variants()->where('wc_variation_id', 1021)->first();
        $this->assertNotNull($v1);
        $this->assertEquals('M', $v1->size);
        $this->assertEquals('White', $v1->color);
        $this->assertEquals(450.00, (float) $v1->sale_price);
        $this->assertEquals(0, (float) $v1->quantity);
    }

    public function test_incoming_webhook_order_creates_wc_order_and_customer(): void
    {
        $webhookSecret = 'test_webhook_secret_key_123';

        WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://myfashionstore.com',
            'consumer_key' => 'ck_test_key',
            'consumer_secret' => 'cs_test_secret',
            'webhook_secret' => $webhookSecret,
            'online_branch_id' => $this->onlineWarehouse->id,
            'is_active' => true,
        ]);

        $payload = [
            'id' => 5001,
            'status' => 'processing',
            'total' => '550.00',
            'shipping_total' => '50.00',
            'discount_total' => '20.00',
            'payment_method' => 'cod',
            'customer_id' => 99,
            'billing' => [
                'first_name' => 'طارق',
                'last_name' => 'محمود',
                'phone' => '+201012345678', // Egyptian international format
                'email' => 'tarek@example.com',
                'address_1' => '15 شارع النصر',
                'city' => 'الإسكندرية',
                'state' => 'الإسكندرية',
            ],
            'shipping' => [
                'first_name' => 'طارق',
                'last_name' => 'محمود',
                'address_1' => '15 شارع النصر',
                'city' => 'الإسكندرية',
                'state' => 'الإسكندرية',
            ],
            'line_items' => [
                [
                    'id' => 1,
                    'product_id' => 101,
                    'name' => 'تيشيرت قطن',
                    'quantity' => 2,
                    'price' => 250.00,
                    'total' => '500.00',
                ],
            ],
        ];

        $rawBody = json_encode($payload);
        $signature = base64_encode(hash_hmac('sha256', $rawBody, $webhookSecret, true));

        $response = $this->call(
            'POST',
            "/api/webhooks/woocommerce/{$this->owner->id}",
            [],
            [],
            [],
            [
                'HTTP_X_WC_WEBHOOK_SIGNATURE' => $signature,
                'CONTENT_TYPE' => 'application/json',
            ],
            $rawBody
        );

        $response->assertOk()
            ->assertJsonPath('success', true);

        // Verify customer created with normalized phone
        $party = Party::where('user_id', $this->owner->id)->where('wc_email', 'tarek@example.com')->first();
        $this->assertNotNull($party);
        $this->assertEquals('01012345678', $party->phone, 'Phone must be normalized to Egyptian local format');

        // Verify WcOrder record created
        $order = WcOrder::where('user_id', $this->owner->id)->where('wc_order_id', 5001)->first();
        $this->assertNotNull($order);
        $this->assertEquals(WcOrderStatus::PENDING_CONFIRMATION, $order->status);
        $this->assertEquals(WcPaymentStatus::PENDING_COD, $order->payment_status);
        $this->assertEquals(50.00, (float) $order->shipping_cost);
        $this->assertEquals(20.00, (float) $order->discount_total);
        $this->assertEquals(550.00, (float) $order->total);

        // Test Idempotency: sending identical webhook again must not duplicate
        $dupResponse = $this->call(
            'POST',
            "/api/webhooks/woocommerce/{$this->owner->id}",
            [],
            [],
            [],
            [
                'HTTP_X_WC_WEBHOOK_SIGNATURE' => $signature,
                'CONTENT_TYPE' => 'application/json',
            ],
            $rawBody
        );

        $dupResponse->assertOk();
        $this->assertEquals(1, WcOrder::where('user_id', $this->owner->id)->where('wc_order_id', 5001)->count());
    }

    public function test_wc_order_fulfillment_lifecycle_confirm_dispatch_deliver(): void
    {
        // 1. Create product and give stock to onlineWarehouse
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'حذاء رياضي',
            'code' => 'SHOE-01',
            'barcode' => 'SHOE-01',
            'wc_product_id' => 201,
            'purchase_price' => 150,
            'sale_price' => 300,
            'quantity' => 10,
        ]);

        BranchStock::create([
            'branch_id' => $this->onlineWarehouse->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        $party = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'عميل سريع',
            'phone' => '01234567890',
            'type' => 'CUSTOMER',
        ]);

        $order = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 7001,
            'party_id' => $party->id,
            'branch_id' => $this->onlineWarehouse->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'shipping_cost' => 40.00,
            'discount_total' => 0,
            'subtotal' => 600.00,
            'total' => 640.00,
            'customer_name' => 'عميل سريع',
            'customer_phone' => '01234567890',
            'items_snapshot' => [
                [
                    'product_id' => 201,
                    'name' => 'حذاء رياضي',
                    'quantity' => 2,
                    'price' => 300.00,
                    'total' => 600.00,
                ],
            ],
        ]);

        // Step 1: Confirm order with sufficient stock
        $confirmRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/wc-orders/{$order->id}/confirm", [
                'branch_id' => $this->onlineWarehouse->id,
            ]);

        $confirmRes->assertOk();
        $this->assertEquals(WcOrderStatus::CONFIRMED, $order->fresh()->status);

        // Step 2: Dispatch order to mandob (creates StockTransfer from onlineWarehouse to vanBranch)
        $dispatchRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/wc-orders/{$order->id}/dispatch", [
                'mandob_id' => $this->mandob->id,
            ]);

        $dispatchRes->assertOk();
        $this->assertEquals(WcOrderStatus::DISPATCHED, $order->fresh()->status);
        $this->assertEquals($this->mandob->id, $order->fresh()->mandob_id);

        // Step 3: Deliver order and collect cash (creates Invoice)
        Http::fake([
            'https://myfashionstore.com/wp-json/wc/v3/orders/7001*' => Http::response([], 200),
        ]);

        $deliverRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/wc-orders/{$order->id}/deliver", [
                'collected_amount' => 640.00,
                'payment_method' => 'CASH',
            ]);

        $deliverRes->assertOk()
            ->assertJsonPath('success', true);

        $order->refresh();
        $this->assertEquals(WcOrderStatus::DELIVERED, $order->status);
        $this->assertEquals(WcPaymentStatus::COLLECTED, $order->payment_status);
        $this->assertNotNull($order->invoice_id);

        // Verify invoice details
        $invoice = $order->invoice;
        $this->assertNotNull($invoice);
        $this->assertEquals(7001, $invoice->wc_order_id);
        $this->assertEquals(40.00, (float) $invoice->shipping_amount);
        $this->assertEquals(640.00, (float) $invoice->total);
        $this->assertEquals(640.00, (float) $invoice->paid_amount);

        // Verify that invoice, payment, and treasury custody belong to the Mandob
        $this->assertEquals($this->mandob->id, $invoice->created_by);
        $mandobTreasury = $this->mandob->assignedTreasury;
        $this->assertNotNull($mandobTreasury);
        $this->assertEquals(640.00, (float) $mandobTreasury->fresh()->balance);

        $payment = $invoice->payments()->first();
        $this->assertNotNull($payment);
        $this->assertEquals($mandobTreasury->id, $payment->treasury_id);
        $this->assertEquals($this->mandob->id, $payment->created_by);
    }

    public function test_promotional_sale_price_import_and_purchase_with_branch_and_variant(): void
    {
        $integration = WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://myfashionstore.com',
            'consumer_key' => 'ck_test_key',
            'consumer_secret' => 'cs_test_secret',
            'online_branch_id' => $this->onlineWarehouse->id,
            'auto_sync_stock' => true,
            'is_active' => true,
        ]);

        // 1. Test promotional pricing import (sale_price & price vs regular_price)
        Http::fake([
            'https://myfashionstore.com/wp-json/wc/v3/products?page=1&per_page=50*' => Http::response([
                [
                    'id' => 999,
                    'name' => 'شنطة ظهر أنيقة',
                    'type' => 'simple',
                    'regular_price' => '60.00',
                    'sale_price' => '45.00',
                    'price' => '45.00',
                    'sku' => 'BAG-SALE-01',
                    'manage_stock' => true,
                    'stock_quantity' => 0,
                ],
            ], 200),
            'https://myfashionstore.com/wp-json/wc/v3/products?page=2&per_page=50*' => Http::response([], 200),
        ]);

        $importRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/woocommerce/import-products');
        $importRes->assertOk();

        $product = Product::where('user_id', $this->owner->id)->where('wc_product_id', 999)->first();
        $this->assertNotNull($product);
        // Assert that active promotional price 45 is used, not 60!
        $this->assertEquals(45.00, (float) $product->sale_price);

        // 2. Create a variable product with variants
        $varProduct = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'تيشيرت صيفي',
            'type' => 'VARIABLE',
            'has_variants' => true,
            'purchase_price' => 100,
            'sale_price' => 150,
            'wc_product_id' => 888,
        ]);
        $variant = $varProduct->variants()->create([
            'user_id' => $this->owner->id,
            'name' => 'أزرق / L',
            'color' => 'أزرق',
            'size' => 'L',
            'purchase_price' => 110,
            'sale_price' => 160,
            'wc_variation_id' => 8881,
            'quantity' => 0,
        ]);

        // 3. Purchase invoice specifying onlineWarehouse branch and variant
        Http::fake([
            'https://myfashionstore.com/wp-json/wc/v3/products/888/variations/8881*' => Http::response(['id' => 8881, 'stock_quantity' => 15], 200),
        ]);

        $purchaseRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/invoices', [
                'type' => 'PURCHASE',
                'branch_id' => $this->onlineWarehouse->id,
                'date' => now()->toDateString(),
                'payment_method' => 'CASH',
                'items' => [
                    [
                        'product_id' => $varProduct->id,
                        'product_variant_id' => $variant->id,
                        'variant_name' => 'أزرق / L',
                        'quantity' => 15,
                        'unit_price' => 110.00,
                    ],
                ],
            ]);

        $purchaseRes->assertCreated();

        // Verify BranchStock was updated for onlineWarehouse
        $branchStock = BranchStock::where('branch_id', $this->onlineWarehouse->id)
            ->where('product_id', $varProduct->id)
            ->where('product_variant_id', $variant->id)
            ->first();

        $this->assertNotNull($branchStock);
        $this->assertEquals(15.00, (float) $branchStock->quantity);
        $this->assertEquals(15.00, (float) $variant->fresh()->quantity);

        // Verify stock push job uses online_branch_id
        $job = new \App\Jobs\PushStockToWooCommerceJob($this->owner->id, $varProduct->id, $variant->id);
        $apiClient = app(\App\Services\WooCommerce\WooCommerceApiClient::class);
        $job->handle($apiClient);

        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'variations/8881') &&
                $request['stock_quantity'] === 15;
        });
    }
}
