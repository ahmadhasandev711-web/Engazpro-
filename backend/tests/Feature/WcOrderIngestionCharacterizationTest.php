<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Branch;
use App\Models\Party;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WcOrderItem;
use App\Models\WooCommerceIntegration;
use App\Contracts\WooCommerceApiClientInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class WcOrderIngestionCharacterizationTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $mainBranch;
    protected WooCommerceIntegration $integration;
    protected Product $simpleProduct;
    protected Product $variableProduct;
    protected ProductVariant $variant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => 'OWNER']);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now(),
            'end_date' => now()->addYear(),
            'status' => 'ACTIVE',
            'plan' => 'ANNUAL',
            'price' => 1000,
        ]);

        $this->mainBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'BR-01',
            'type' => BranchType::STORE->value,
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://char-test-store.com',
            'consumer_key' => 'ck_char_test',
            'consumer_secret' => 'cs_char_test',
            'webhook_secret' => 'whsec_char_characterization_secret_123',
            'is_active' => true,
            'auto_sync_stock' => true,
            'online_branch_id' => $this->mainBranch->id,
        ]);

        $this->simpleProduct = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'قميص قطني',
            'wc_product_id' => 901,
            'price' => 100,
            'cost_price' => 60,
            'quantity' => 20,
        ]);

        $this->variableProduct = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'بنطلون جينز',
            'wc_product_id' => 902,
            'price' => 150,
            'cost_price' => 90,
            'quantity' => 20,
            'has_variants' => true,
        ]);

        $this->variant = ProductVariant::create([
            'user_id' => $this->owner->id,
            'product_id' => $this->variableProduct->id,
            'name' => 'كحلي 32',
            'wc_variation_id' => 9021,
            'price' => 150,
            'cost_price' => 90,
            'quantity' => 10,
        ]);

        $mockClient = $this->createMock(WooCommerceApiClientInterface::class);
        $mockClient->method('updateProductStock')->willReturn(true);
        $mockClient->method('updateVariationStock')->willReturn(true);
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);
    }

    protected function sendWebhook(array $payload, string $topic = 'order.created'): TestResponse
    {
        $raw = json_encode($payload, JSON_UNESCAPED_UNICODE);
        $sig = base64_encode(hash_hmac('sha256', $raw, $this->integration->webhook_secret, true));

        return $this->call(
            'POST',
            "/api/webhooks/woocommerce/{$this->owner->id}",
            [],
            [],
            [],
            [
                'HTTP_X_WC_WEBHOOK_SIGNATURE' => $sig,
                'HTTP_X_WC_WEBHOOK_TOPIC' => $topic,
                'CONTENT_TYPE' => 'application/json',
            ],
            $raw
        );
    }

    protected function loadFixture(string $filename): array
    {
        $path = __DIR__ . '/../Fixtures/woocommerce/' . $filename;
        return json_decode(file_get_contents($path), true);
    }

    /**
     * Case a: New COD order with simple, variation, unimported line items, coupon, shipping, Bosta meta tracking.
     */
    public function test_characterize_case_a_new_cod_order(): void
    {
        $payload = $this->loadFixture('cod_order.json');
        $response = $this->sendWebhook($payload);
        $response->assertStatus(202);

        $order = WcOrder::where('user_id', $this->owner->id)->where('wc_order_id', 50001)->firstOrFail();
        $party = Party::where('user_id', $this->owner->id)->where('id', $order->party_id)->firstOrFail();
        $items = WcOrderItem::where('wc_order_id', $order->id)->orderBy('id')->get();

        $expectedOrder = [
            'user_id' => $this->owner->id,
            'wc_order_id' => 50001,
            'order_date' => '2026-03-01 12:00:00',
            'party_id' => $party->id,
            'branch_id' => $this->mainBranch->id,
            'tracking_number' => 'BOSTA-998877',
            'courier_name' => 'بوسطة (Bosta)',
            'status' => WcOrderStatus::PENDING_CONFIRMATION->value,
            'payment_status' => WcPaymentStatus::PENDING_COD->value,
            'wc_payment_method' => 'cod',
            'shipping_cost' => '50.00',
            'subtotal' => '350.00',
            'discount_total' => '30.00',
            'total' => '370.00',
            'customer_name' => 'أحمد حسن',
            'customer_phone' => '01011112222',
            'customer_email' => 'ahmed.cod@example.com',
            'customer_address' => '10 شارع التحرير, شقة 4, الدقي, الجيزة',
            'governorate' => 'الجيزة',
            'city' => 'الدقي',
            'notes' => null,
            'wc_coupon_codes' => ['DISCOUNT30'],
        ];

        $actualOrder = [
            'user_id' => $order->user_id,
            'wc_order_id' => $order->wc_order_id,
            'order_date' => $order->order_date?->format('Y-m-d H:i:s'),
            'party_id' => $order->party_id,
            'branch_id' => $order->branch_id,
            'tracking_number' => $order->tracking_number,
            'courier_name' => $order->courier_name,
            'status' => $order->status->value,
            'payment_status' => $order->payment_status->value,
            'wc_payment_method' => $order->wc_payment_method,
            'shipping_cost' => (string) $order->shipping_cost,
            'subtotal' => (string) $order->subtotal,
            'discount_total' => (string) $order->discount_total,
            'total' => (string) $order->total,
            'customer_name' => $order->customer_name,
            'customer_phone' => $order->customer_phone,
            'customer_email' => $order->customer_email,
            'customer_address' => $order->customer_address,
            'governorate' => $order->governorate,
            'city' => $order->city,
            'notes' => $order->notes,
            'wc_coupon_codes' => $order->wc_coupon_codes,
        ];

        $this->assertSame($expectedOrder, $actualOrder);

        $expectedParty = [
            'user_id' => $this->owner->id,
            'name' => 'أحمد حسن',
            'phone' => '01011112222',
            'address' => '10 شارع التحرير, شقة 4, الدقي, الجيزة',
            'type' => 'CUSTOMER',
            'wc_customer_id' => 1234,
            'wc_email' => 'ahmed.cod@example.com',
        ];

        $actualParty = [
            'user_id' => $party->user_id,
            'name' => $party->name,
            'phone' => $party->phone,
            'address' => $party->address,
            'type' => $party->type,
            'wc_customer_id' => $party->wc_customer_id,
            'wc_email' => $party->wc_email,
        ];

        $this->assertSame($expectedParty, $actualParty);

        $this->assertCount(3, $items);
        $expectedItems = [
            [
                'user_id' => $this->owner->id,
                'wc_order_id' => $order->id,
                'product_id' => $this->simpleProduct->id,
                'product_variant_id' => null,
                'wc_product_id' => 901,
                'wc_variation_id' => null,
                'quantity' => '2.00',
            ],
            [
                'user_id' => $this->owner->id,
                'wc_order_id' => $order->id,
                'product_id' => $this->variableProduct->id,
                'product_variant_id' => $this->variant->id,
                'wc_product_id' => 902,
                'wc_variation_id' => 9021,
                'quantity' => '1.00',
            ],
            [
                'user_id' => $this->owner->id,
                'wc_order_id' => $order->id,
                'product_id' => null,
                'product_variant_id' => null,
                'wc_product_id' => 99999,
                'wc_variation_id' => null,
                'quantity' => '1.00',
            ],
        ];

        $actualItems = $items->map(fn($it) => [
            'user_id' => $it->user_id,
            'wc_order_id' => $it->wc_order_id,
            'product_id' => $it->product_id,
            'product_variant_id' => $it->product_variant_id,
            'wc_product_id' => $it->wc_product_id,
            'wc_variation_id' => $it->wc_variation_id,
            'quantity' => (string) $it->quantity,
        ])->all();

        $this->assertSame($expectedItems, $actualItems);
    }

    /**
     * Case b: Online paid order (paymob) -> PAID_ONLINE.
     */
    public function test_characterize_case_b_online_paid_order(): void
    {
        $payload = $this->loadFixture('online_paid_order.json');
        $response = $this->sendWebhook($payload);
        $response->assertStatus(202);

        $order = WcOrder::where('user_id', $this->owner->id)->where('wc_order_id', 50002)->firstOrFail();
        $party = Party::where('user_id', $this->owner->id)->where('id', $order->party_id)->firstOrFail();

        $expectedOrder = [
            'user_id' => $this->owner->id,
            'wc_order_id' => 50002,
            'order_date' => '2026-03-02 14:30:00',
            'party_id' => $party->id,
            'branch_id' => $this->mainBranch->id,
            'tracking_number' => null,
            'courier_name' => null,
            'status' => WcOrderStatus::PENDING_CONFIRMATION->value,
            'payment_status' => WcPaymentStatus::PAID_ONLINE->value,
            'wc_payment_method' => 'paymob',
            'shipping_cost' => '20.00',
            'subtotal' => '100.00',
            'discount_total' => '0.00',
            'total' => '120.00',
            'customer_name' => 'سارة علي',
            'customer_phone' => '01122223333',
            'customer_email' => 'sara@example.com',
            'customer_address' => 'المعادي, القاهرة, القاهرة',
            'governorate' => 'القاهرة',
            'city' => 'القاهرة',
            'notes' => null,
            'wc_coupon_codes' => [],
        ];

        $actualOrder = [
            'user_id' => $order->user_id,
            'wc_order_id' => $order->wc_order_id,
            'order_date' => $order->order_date?->format('Y-m-d H:i:s'),
            'party_id' => $order->party_id,
            'branch_id' => $order->branch_id,
            'tracking_number' => $order->tracking_number,
            'courier_name' => $order->courier_name,
            'status' => $order->status->value,
            'payment_status' => $order->payment_status->value,
            'wc_payment_method' => $order->wc_payment_method,
            'shipping_cost' => (string) $order->shipping_cost,
            'subtotal' => (string) $order->subtotal,
            'discount_total' => (string) $order->discount_total,
            'total' => (string) $order->total,
            'customer_name' => $order->customer_name,
            'customer_phone' => $order->customer_phone,
            'customer_email' => $order->customer_email,
            'customer_address' => $order->customer_address,
            'governorate' => $order->governorate,
            'city' => $order->city,
            'notes' => $order->notes,
            'wc_coupon_codes' => $order->wc_coupon_codes,
        ];

        $this->assertSame($expectedOrder, $actualOrder);
    }

    /**
     * Case c: Same order arrives again with previously empty phone & address -> filled, rest untouched.
     */
    public function test_characterize_case_c_idempotent_field_enrichment(): void
    {
        // 1. First ingestion with missing phone and address
        $initialPayload = [
            'id' => 50003,
            'status' => 'processing',
            'date_created' => '2026-03-03T10:00:00',
            'total' => '100.00',
            'shipping_total' => '0.00',
            'discount_total' => '0.00',
            'payment_method' => 'cod',
            'customer_id' => 1236,
            'billing' => [
                'first_name' => 'كريم',
                'last_name' => 'محمود',
                'phone' => '',
                'email' => 'karim@example.com',
                'address_1' => '',
                'city' => '',
                'state' => '',
            ],
            'shipping' => [
                'first_name' => 'كريم',
                'last_name' => 'محمود',
                'phone' => '',
                'address_1' => '',
                'city' => '',
                'state' => '',
            ],
            'line_items' => [
                [
                    'id' => 301,
                    'product_id' => 901,
                    'name' => 'قميص قطني',
                    'quantity' => 1,
                    'price' => 100,
                    'total' => '100.00',
                ],
            ],
        ];

        $this->sendWebhook($initialPayload)->assertStatus(202);
        $firstOrder = WcOrder::where('user_id', $this->owner->id)->where('wc_order_id', 50003)->firstOrFail();
        $this->assertNull($firstOrder->customer_phone);
        $this->assertNull($firstOrder->customer_address);

        // 2. Second ingestion with phone and address provided
        $updatePayload = $this->loadFixture('update_order_fields.json');
        $this->sendWebhook($updatePayload, 'order.updated')->assertStatus(202);

        $refreshedOrder = $firstOrder->fresh();

        $this->assertSame($firstOrder->id, $refreshedOrder->id);
        $this->assertSame('01233334444', $refreshedOrder->customer_phone);
        $this->assertSame('55 شارع النصر, مدينة نصر, القاهرة', $refreshedOrder->customer_address);
        $this->assertSame('القاهرة', $refreshedOrder->governorate);
        $this->assertSame('مدينة نصر', $refreshedOrder->city);
        $this->assertSame('100.00', (string) $refreshedOrder->total);
        $this->assertSame(WcOrderStatus::PENDING_CONFIRMATION, $refreshedOrder->status);
    }

    /**
     * Case d: Cancellation sync:
     * - Status=cancelled when PENDING -> CANCELLED + cancel tag in notes.
     * - Status=cancelled when DISPATCHED -> status remains DISPATCHED + warning tag in notes.
     */
    public function test_characterize_case_d_cancellation_sync(): void
    {
        // Subcase 1: Pending order gets cancelled
        $payload1 = $this->loadFixture('cancelled_order.json');
        // First create it as processing
        $payload1Pending = $payload1;
        $payload1Pending['status'] = 'processing';
        $this->sendWebhook($payload1Pending)->assertStatus(202);

        $order1 = WcOrder::where('user_id', $this->owner->id)->where('wc_order_id', 50004)->firstOrFail();
        $this->assertSame(WcOrderStatus::PENDING_CONFIRMATION, $order1->status);

        // Webhook arrives with status=cancelled
        $this->sendWebhook($payload1, 'order.updated')->assertStatus(202);
        $order1->refresh();

        $this->assertSame(WcOrderStatus::CANCELLED, $order1->status);
        $this->assertStringContainsString('[تم إلغاء الطلب من WooCommerce]', $order1->notes);

        // Subcase 2: Dispatched order receives cancellation
        $payload2 = $payload1;
        $payload2['id'] = 50006;
        $payload2['status'] = 'processing';
        $this->sendWebhook($payload2)->assertStatus(202);

        $order2 = WcOrder::where('user_id', $this->owner->id)->where('wc_order_id', 50006)->firstOrFail();
        // Move to DISPATCHED
        $order2->update([
            'status' => WcOrderStatus::DISPATCHED,
            'branch_id' => $this->mainBranch->id,
        ]);

        $payload2Cancelled = $payload2;
        $payload2Cancelled['status'] = 'cancelled';
        $this->sendWebhook($payload2Cancelled, 'order.updated')->assertStatus(202);
        $order2->refresh();

        $this->assertSame(WcOrderStatus::DISPATCHED, $order2->status);
        $this->assertStringContainsString("[تحذير: تم إلغاء الطلب من WooCommerce ولكن حالته بالنظام 'خرج للشحن مع المندوب']", $order2->notes);
    }

    /**
     * Case e: Name fallback:
     * - Missing shipping name -> from billing
     * - Missing billing name -> from party
     * - Missing party name -> 'عميل أونلاين'
     */
    public function test_characterize_case_e_name_fallback_hierarchy(): void
    {
        // 1. Fallback to billing name when shipping name is empty
        $payload1 = $this->loadFixture('no_name_order.json');
        $payload1['id'] = 50007;
        $payload1['customer_id'] = 9875;
        $payload1['billing']['first_name'] = 'سامي';
        $payload1['billing']['last_name'] = 'يوسف';
        $payload1['billing']['phone'] = '01011110001';
        $payload1['billing']['email'] = 'sami.subcase1@example.com';
        $this->sendWebhook($payload1)->assertStatus(202);

        $order1 = WcOrder::where('user_id', $this->owner->id)->where('wc_order_id', 50007)->firstOrFail();
        $this->assertSame('سامي يوسف', $order1->customer_name);

        // 2. Fallback to party name when shipping & billing names are empty
        $payload2 = $this->loadFixture('no_name_order.json');
        $payload2['id'] = 50008;
        $payload2['customer_id'] = 9876;
        $payload2['billing']['phone'] = '01011110002';
        $payload2['billing']['email'] = 'subcase2@example.com';
        $existingParty = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'العميل الدائم المسجل',
            'phone' => '01011110002',
            'type' => 'CUSTOMER',
            'wc_customer_id' => 9876,
        ]);
        $this->sendWebhook($payload2)->assertStatus(202);

        $order2 = WcOrder::where('user_id', $this->owner->id)->where('wc_order_id', 50008)->firstOrFail();
        $this->assertSame('العميل الدائم المسجل', $order2->customer_name);

        // 3. Fallback to 'عميل أونلاين' when shipping, billing, and party name are empty
        $payload3 = $this->loadFixture('no_name_order.json');
        $payload3['id'] = 50009;
        $payload3['customer_id'] = null; // guest without name
        $payload3['billing']['phone'] = '';
        $payload3['billing']['email'] = '';
        $this->sendWebhook($payload3)->assertStatus(202);

        $order3 = WcOrder::where('user_id', $this->owner->id)->where('wc_order_id', 50009)->firstOrFail();
        $this->assertSame('عميل أونلاين', $order3->customer_name);
    }
}
