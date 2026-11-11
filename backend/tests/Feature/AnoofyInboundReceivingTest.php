<?php

namespace Tests\Feature;

use App\Enums\AnoofyEventResult;
use App\Enums\AnoofyEventType;
use App\Enums\UserRole;
use App\Enums\WcOrderStatus;
use App\Models\AnoofyInboxEvent;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WcOrderItem;
use App\Models\WooCommerceIntegration;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\SimulatesHttpContext;
use Tests\TestCase;

class AnoofyInboundReceivingTest extends TestCase
{
    use RefreshDatabase, SimulatesHttpContext;

    private User $user;
    private WooCommerceIntegration $integration;
    private string $secret = 'anoofy-secret-key-1234567890123456';
    private string $kid = '01JBC4M8R0G1Z6Q9W3X4K7M2P1';

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create(['role' => UserRole::OWNER]);
        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->user->id,
            'store_url' => 'https://mystore.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'is_active' => true,
            'anoofy_key_id' => $this->kid,
            'anoofy_secret' => $this->secret,
            'anoofy_connected_at' => CarbonImmutable::parse('2026-11-04T10:00:00Z'),
        ]);
    }

    public function test_rejects_missing_or_unknown_kid(): void
    {
        $response = $this->postJson('/api/webhooks/anoofy/events', [], [
            'X-Anoofy-Key-Id' => 'non-existent-kid',
            'X-Anoofy-Timestamp' => (string) now()->timestamp,
            'X-Anoofy-Signature' => 'dummy',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'error_code' => 'ANOOFY_NOT_CONNECTED',
            ]);
    }

    public function test_rejects_expired_timestamp(): void
    {
        $timestamp = now()->subSeconds(301)->timestamp;
        $body = json_encode(['schema_version' => 1]);
        $sig = hash_hmac('sha256', "{$timestamp}.{$body}", $this->secret);

        $response = $this->call(
            'POST',
            '/api/webhooks/anoofy/events',
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $this->kid,
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $timestamp,
                'HTTP_X_ANOOFY_SIGNATURE' => $sig,
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'error_code' => 'INVALID_ANOOFY_SIGNATURE',
            ]);
    }

    public function test_rejects_invalid_signature(): void
    {
        $timestamp = now()->timestamp;
        $body = json_encode(['schema_version' => 1]);

        $response = $this->call(
            'POST',
            '/api/webhooks/anoofy/events',
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $this->kid,
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $timestamp,
                'HTTP_X_ANOOFY_SIGNATURE' => 'wrong-signature',
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'error_code' => 'INVALID_ANOOFY_SIGNATURE',
            ]);
    }

    public function test_rejects_invalid_payload(): void
    {
        $timestamp = now()->timestamp;
        $body = 'invalid-json';
        $sig = hash_hmac('sha256', "{$timestamp}.{$body}", $this->secret);

        $response = $this->call(
            'POST',
            '/api/webhooks/anoofy/events',
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $this->kid,
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $timestamp,
                'HTTP_X_ANOOFY_SIGNATURE' => $sig,
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error_code' => 'INVALID_ANOOFY_PAYLOAD',
            ]);
    }

    public function test_processes_valid_event_and_records_inbox(): void
    {
        WcOrder::create([
            'user_id' => $this->user->id,
            'wc_order_id' => 5001,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
        ]);

        $timestamp = now()->timestamp;
        $fixturePath = dirname(__DIR__, 2) . '/../docs/integrations/fixtures/order.confirmed.json';
        $body = (string) file_get_contents($fixturePath);
        $sig = hash_hmac('sha256', "{$timestamp}.{$body}", $this->secret);

        $response = $this->call(
            'POST',
            '/api/webhooks/anoofy/events',
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $this->kid,
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $timestamp,
                'HTTP_X_ANOOFY_SIGNATURE' => $sig,
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'result' => AnoofyEventResult::PROCESSED->value,
                ],
            ]);

        $this->assertDatabaseHas('anoofy_inbox_events', [
            'user_id' => $this->user->id,
            'event_id' => '22222222-2222-4222-8222-222222222222',
            'event_type' => AnoofyEventType::ORDER_CONFIRMED->value,
            'order_version' => 1,
            'result' => AnoofyEventResult::PROCESSED->value,
        ]);
    }

    public function test_handles_duplicate_event_idempotently(): void
    {
        AnoofyInboxEvent::create([
            'user_id' => $this->user->id,
            'event_id' => '22222222-2222-4222-8222-222222222222',
            'event_type' => AnoofyEventType::ORDER_CONFIRMED->value,
            'order_version' => 1,
            'result' => AnoofyEventResult::PROCESSED->value,
            'received_at' => now()->subMinute(),
        ]);

        $timestamp = now()->timestamp;
        $fixturePath = dirname(__DIR__, 2) . '/../docs/integrations/fixtures/order.confirmed.json';
        $body = (string) file_get_contents($fixturePath);
        $sig = hash_hmac('sha256', "{$timestamp}.{$body}", $this->secret);

        $response = $this->call(
            'POST',
            '/api/webhooks/anoofy/events',
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $this->kid,
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $timestamp,
                'HTTP_X_ANOOFY_SIGNATURE' => $sig,
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'result' => AnoofyEventResult::DUPLICATE->value,
                    'reason' => 'already_processed',
                ],
            ]);

        // Still only 1 row in DB
        $this->assertSame(1, AnoofyInboxEvent::withoutGlobalScopes()->where('event_id', '22222222-2222-4222-8222-222222222222')->count());
    }

    public function test_rejects_non_verify_event_when_not_yet_connected(): void
    {
        $this->integration->anoofy_connected_at = null;
        $this->integration->save();

        WcOrder::create([
            'user_id' => $this->user->id,
            'wc_order_id' => 5001,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
        ]);

        $timestamp = now()->timestamp;
        $fixturePath = dirname(__DIR__, 2) . '/../docs/integrations/fixtures/order.confirmed.json';
        $body = (string) file_get_contents($fixturePath);
        $sig = hash_hmac('sha256', "{$timestamp}.{$body}", $this->secret);

        $response = $this->call(
            'POST',
            '/api/webhooks/anoofy/events',
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $this->kid,
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $timestamp,
                'HTTP_X_ANOOFY_SIGNATURE' => $sig,
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'error_code' => 'ANOOFY_NOT_CONNECTED',
            ]);

        $this->assertSame(0, AnoofyInboxEvent::withoutGlobalScopes()->where('event_id', '22222222-2222-4222-8222-222222222222')->count());
    }

    public function test_order_confirmed_handles_two_decimal_string_prices(): void
    {
        Queue::fake();

        $order = WcOrder::create([
            'user_id' => $this->user->id,
            'wc_order_id' => 5001,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'shipping_cost' => 15.00,
            'discount_total' => 10.00,
            'subtotal' => 0,
            'total' => 5.00,
        ]);

        $payload = [
            'schema_version' => 1,
            'event_id' => '22222222-2222-4222-8222-333333333333',
            'event_type' => AnoofyEventType::ORDER_CONFIRMED->value,
            'occurred_at' => '2026-11-11T12:00:00Z',
            'order_version' => 1,
            'data' => [
                'wc_order_id' => 5001,
                'confirmed_at' => '2026-11-11T12:00:00Z',
                'confirmed_by_name' => 'أحمد محمود',
                'customer' => [
                    'phone' => '01011223344',
                    'address_1' => 'شارع الجمهورية',
                    'city' => 'المنصورة',
                    'state' => 'الدقهلية',
                ],
                'line_items' => [
                    [
                        'wc_product_id' => 901,
                        'name' => 'صنف أ',
                        'quantity' => 3,
                        'price' => '33.33',
                        'total' => '99.99',
                    ],
                    [
                        'wc_product_id' => 902,
                        'name' => 'صنف ب',
                        'quantity' => 1,
                        'price' => '100.00',
                        'total' => '100.00',
                    ],
                ],
            ],
        ];

        $body = json_encode($payload);
        $timestamp = now()->timestamp;
        $sig = hash_hmac('sha256', "{$timestamp}.{$body}", $this->secret);

        $response = $this->call(
            'POST',
            '/api/webhooks/anoofy/events',
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $this->kid,
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $timestamp,
                'HTTP_X_ANOOFY_SIGNATURE' => $sig,
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'result' => AnoofyEventResult::PROCESSED->value,
                ],
            ]);

        $order->refresh();

        // subtotal = 99.99 + 100.00 = 199.99
        $this->assertEquals('199.99', (string) $order->subtotal);

        // total = subtotal + shipping (15.00) - discount (10.00) = 204.99
        $expectedTotal = (float) $order->subtotal + (float) $order->shipping_cost - (float) $order->discount_total;
        $this->assertEquals(204.99, (float) $order->total);
        $this->assertEquals($expectedTotal, (float) $order->total);

        // wc_order_items assertions
        $items = WcOrderItem::withoutGlobalScopes()->where('wc_order_id', $order->id)->orderBy('wc_product_id')->get();
        $this->assertCount(2, $items);
        $this->assertEquals(901, $items[0]->wc_product_id);
        $this->assertEquals(3, (int) $items[0]->quantity);
        $this->assertEquals(902, $items[1]->wc_product_id);
        $this->assertEquals(1, (int) $items[1]->quantity);

        $this->assertDatabaseHas('wc_order_items', [
            'wc_order_id' => $order->id,
            'wc_product_id' => 901,
            'quantity' => 3,
        ]);
        $this->assertDatabaseHas('wc_order_items', [
            'wc_order_id' => $order->id,
            'wc_product_id' => 902,
            'quantity' => 1,
        ]);

        // items_snapshot assertions
        $this->assertIsArray($order->items_snapshot);
        $this->assertCount(2, $order->items_snapshot);
        $this->assertSame('33.33', $order->items_snapshot[0]['price']);
        $this->assertSame('99.99', $order->items_snapshot[0]['total']);
        $this->assertSame('100.00', $order->items_snapshot[1]['price']);
        $this->assertSame('100.00', $order->items_snapshot[1]['total']);
    }
}
