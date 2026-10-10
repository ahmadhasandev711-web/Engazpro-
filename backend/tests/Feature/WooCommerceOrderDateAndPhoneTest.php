<?php

namespace Tests\Feature;

use App\Enums\PartyType;
use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\Party;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WooCommerceIntegration;
use App\Services\WooCommerce\WooCommerceOrderSyncService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WooCommerceOrderDateAndPhoneTest extends TestCase
{
    use RefreshDatabase;

    public function test_incoming_order_extracts_order_date_and_falls_back_from_empty_shipping_phone(): void
    {
        $user = User::factory()->create(['role' => UserRole::OWNER->value]);
        \App\Models\Subscription::create([
            'user_id' => $user->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
        ]);
        $branch = Branch::create([
            'user_id' => $user->id,
            'name' => 'Main Branch',
            'code' => 'MAIN',
            'is_main' => true,
        ]);

        WooCommerceIntegration::create([
            'user_id' => $user->id,
            'store_url' => 'https://mystore.test',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'online_branch_id' => $branch->id,
            'is_active' => true,
        ]);

        $orderSyncService = app(WooCommerceOrderSyncService::class);

        // WooCommerce payload where shipping phone is empty string, but billing phone has number
        $wcPayload = [
            'id' => 1245,
            'date_created' => '2026-08-15T10:30:00',
            'status' => 'processing',
            'payment_method' => 'cod',
            'total' => '250.00',
            'shipping_total' => '30.00',
            'discount_total' => '0.00',
            'billing' => [
                'first_name' => 'Mohamed',
                'last_name' => 'Ali',
                'phone' => '01012345678',
                'email' => 'mohamed@test.com',
                'address_1' => 'Street 10',
                'city' => 'Nasr City',
                'state' => 'Cairo',
            ],
            'shipping' => [
                'first_name' => 'Mohamed',
                'last_name' => 'Ali',
                'phone' => '', // Notice empty string from WC!
                'address_1' => '', // Notice empty string from WC!
                'city' => '',
                'state' => '',
            ],
            'line_items' => [
                [
                    'product_id' => 999,
                    'name' => 'Test Item',
                    'quantity' => 1,
                    'price' => '220.00',
                ],
            ],
        ];

        $order = $orderSyncService->handleIncomingOrder($user, $wcPayload);

        $this->assertEquals('01012345678', $order->customer_phone);
        $this->assertStringContainsString('Street 10', $order->customer_address);
        $this->assertEquals('Cairo', $order->governorate);
        $this->assertEquals('Nasr City', $order->city);
        $this->assertEquals('2026-08-15 10:30:00', $order->order_date->format('Y-m-d H:i:s'));

        // Test date range filter on API
        $response = $this->actingAs($user)->getJson('/api/wc-orders?date_from=2026-08-01&date_to=2026-08-31');
        $response->assertOk();
        $this->assertCount(1, $response->json('data.data'));

        // Test outside range
        $responseOut = $this->actingAs($user)->getJson('/api/wc-orders?date_from=2026-09-01&date_to=2026-09-30');
        $responseOut->assertOk();
        $this->assertCount(0, $responseOut->json('data.data'));
    }

    public function test_order_date_updated_unconditionally_and_items_enriched_with_images_and_attributes(): void
    {
        $user = User::factory()->create(['role' => UserRole::OWNER->value]);
        \App\Models\Subscription::create([
            'user_id' => $user->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
        ]);
        $branch = Branch::create([
            'user_id' => $user->id,
            'name' => 'Main Branch',
            'code' => 'MAIN',
            'is_main' => true,
        ]);

        WooCommerceIntegration::create([
            'user_id' => $user->id,
            'store_url' => 'https://mystore.test',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'online_branch_id' => $branch->id,
            'is_active' => true,
        ]);

        // Create product and variant with image_url
        $product = \App\Models\Product::create([
            'user_id' => $user->id,
            'name' => 'قميص قطن فاخر',
            'wc_product_id' => 777,
            'sale_price' => 350.00,
            'quantity' => 10,
            'unit' => 'قطعة',
            'image_url' => 'https://mystore.test/images/shirt.jpg',
        ]);

        $variant = $product->variants()->create([
            'user_id' => $user->id,
            'name' => 'لون: أسود | مقاس: XL',
            'wc_variation_id' => 888,
            'sale_price' => 350.00,
            'quantity' => 5,
            'image_url' => 'https://mystore.test/images/shirt-black-xl.jpg',
        ]);

        $orderSyncService = app(WooCommerceOrderSyncService::class);

        // 1. Initial Order with earlier date
        $payload1 = [
            'id' => 5001,
            'date_created' => '2026-07-10T14:00:00',
            'status' => 'processing',
            'payment_method' => 'cod',
            'total' => '350.00',
            'shipping_total' => '0.00',
            'discount_total' => '0.00',
            'billing' => [
                'first_name' => 'أحمد',
                'last_name' => 'مختار',
                'phone' => '01011223344',
            ],
            'line_items' => [
                [
                    'product_id' => 777,
                    'variation_id' => 888,
                    'name' => 'قميص قطن فاخر - أسود, XL',
                    'quantity' => 1,
                    'price' => '350.00',
                    'meta_data' => [
                        [
                            'key' => 'pa_color',
                            'display_key' => 'اللون',
                            'value' => 'black',
                            'display_value' => 'أسود',
                        ],
                        [
                            'key' => 'pa_size',
                            'display_key' => 'المقاس',
                            'value' => 'xl',
                            'display_value' => 'XL',
                        ],
                    ],
                ],
            ],
        ];

        $order = $orderSyncService->handleIncomingOrder($user, $payload1);

        $this->assertEquals('2026-07-10 14:00:00', $order->order_date->format('Y-m-d H:i:s'));
        $snapshot = $order->items_snapshot;
        $this->assertNotEmpty($snapshot);
        $this->assertEquals('https://mystore.test/images/shirt-black-xl.jpg', $snapshot[0]['image_url']);
        $this->assertCount(2, $snapshot[0]['attributes']);
        $this->assertEquals('اللون', $snapshot[0]['attributes'][0]['key']);
        $this->assertEquals('أسود', $snapshot[0]['attributes'][0]['value']);

        // 2. Re-sync with authoritative WC date
        $payload2 = $payload1;
        $payload2['date_created'] = '2026-07-10T15:30:00';
        $updatedOrder = $orderSyncService->handleIncomingOrder($user, $payload2);

        $this->assertEquals('2026-07-10 15:30:00', $updatedOrder->order_date->format('Y-m-d H:i:s'));
    }
}

