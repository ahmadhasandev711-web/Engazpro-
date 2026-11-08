<?php

namespace Tests\Feature;

use App\Contracts\HostResolver;
use App\Enums\AnoofyEventResult;
use App\Enums\AnoofyEventType;
use App\Enums\UserRole;
use App\Enums\WcOrderStatus;
use App\Jobs\PushStockToWooCommerceJob;
use App\Models\AnoofyInboxEvent;
use App\Models\Product;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WcOrderItem;
use App\Models\WooCommerceIntegration;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\SimulatesHttpContext;
use Tests\TestCase;

class AnoofyInboundIntegrationTest extends TestCase
{
    use RefreshDatabase, SimulatesHttpContext;

    private User $owner;
    private WooCommerceIntegration $integration;
    private string $kid = '01JBC4M8R0G1Z6Q9W3X4K7M2P1';
    private string $secret = 'anoofy-secret-integration-test-key-123';

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => UserRole::OWNER]);
        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://mystore.com',
            'consumer_key' => 'ck_test_key',
            'consumer_secret' => 'cs_test_secret',
            'is_active' => true,
            'anoofy_key_id' => $this->kid,
            'anoofy_secret' => $this->secret,
            'anoofy_connected_at' => CarbonImmutable::parse('2026-11-04T10:00:00Z'),
        ]);

        $mockResolver = $this->createMock(HostResolver::class);
        $mockResolver->method('resolve')->willReturn(['93.184.216.34']);
        $this->app->instance(HostResolver::class, $mockResolver);
    }

    private function sendAnoofyRequest(
        string $body,
        ?int $timestamp = null,
        ?string $kid = null,
        ?string $customSignature = null
    ) {
        $ts = $timestamp ?? now()->timestamp;
        $k = $kid ?? $this->kid;
        $sig = $customSignature ?? hash_hmac('sha256', "{$ts}.{$body}", $this->secret);

        return $this->call(
            'POST',
            '/api/webhooks/anoofy/events',
            [],
            [],
            [],
            [
                'HTTP_X_ANOOFY_KEY_ID' => $k,
                'HTTP_X_ANOOFY_TIMESTAMP' => (string) $ts,
                'HTTP_X_ANOOFY_SIGNATURE' => $sig,
                'CONTENT_TYPE' => 'application/json',
            ],
            $body
        );
    }

    // Case a: connection.verify ناجح
    public function test_case_a_connection_verify_success(): void
    {
        $this->integration->anoofy_connected_at = null;
        $this->integration->save();

        $body = json_encode([
            'schema_version' => 1,
            'event_id' => '11111111-1111-4111-8111-111111111111',
            'event_type' => AnoofyEventType::CONNECTION_VERIFY->value,
            'occurred_at' => '2026-11-04T11:00:00Z',
            'order_version' => null,
            'data' => [
                'site_url' => 'https://mystore.com',
                'callback_url' => 'https://mystore.com/wp-json/anoofy/v1/callback',
                'plugin_version' => '1.0.0',
            ],
        ]);

        $response = $this->sendAnoofyRequest($body);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'result' => AnoofyEventResult::PROCESSED->value,
                ],
            ]);

        $this->integration->refresh();
        $this->assertSame('https://mystore.com/wp-json/anoofy/v1/callback', $this->integration->anoofy_callback_url);
        $this->assertNotNull($this->integration->anoofy_connected_at);
        $this->assertDatabaseHas('anoofy_inbox_events', [
            'event_id' => '11111111-1111-4111-8111-111111111111',
            'result' => AnoofyEventResult::PROCESSED->value,
        ]);
    }

    // Case b: connection.verify مع site_url غلط أو callback_url من دومين تاني
    public function test_case_b_connection_verify_domain_mismatch(): void
    {
        $body = json_encode([
            'schema_version' => 1,
            'event_id' => '11111111-1111-4111-8111-111111111112',
            'event_type' => AnoofyEventType::CONNECTION_VERIFY->value,
            'occurred_at' => '2026-11-04T11:00:00Z',
            'order_version' => null,
            'data' => [
                'site_url' => 'https://another-domain.com',
                'callback_url' => 'https://mystore.com/wp-json/anoofy/v1/callback',
                'plugin_version' => '1.0.0',
            ],
        ]);

        $response = $this->sendAnoofyRequest($body);
        $response->assertStatus(422);
    }

    // Case c: order.confirmed ناجح
    public function test_case_c_order_confirmed_success(): void
    {
        Queue::fake();

        $productOld = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف قديم',
            'wc_product_id' => 901,
            'price' => 100,
            'cost_price' => 60,
        ]);
        $productNew = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف جديد',
            'wc_product_id' => 902,
            'price' => 150,
            'cost_price' => 90,
        ]);

        $order = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 5001,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'customer_phone' => '01000000000',
            'subtotal' => 100,
            'total' => 100,
        ]);

        WcOrderItem::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => $order->id,
            'product_id' => $productOld->id,
            'wc_product_id' => 901,
            'quantity' => 1,
        ]);

        $body = json_encode([
            'schema_version' => 1,
            'event_id' => '22222222-2222-4222-8222-222222222222',
            'event_type' => AnoofyEventType::ORDER_CONFIRMED->value,
            'occurred_at' => '2026-11-04T12:00:00Z',
            'order_version' => 1,
            'data' => [
                'wc_order_id' => 5001,
                'confirmed_at' => '2026-11-04T12:00:00Z',
                'confirmed_by_name' => 'أحمد محمود',
                'customer' => [
                    'phone' => '01011223344',
                    'address_1' => 'شارع الجمهورية',
                    'city' => 'المنصورة',
                    'state' => 'الدقهلية',
                ],
                'line_items' => [
                    [
                        'wc_product_id' => 902,
                        'quantity' => 2,
                        'name' => 'صنف جديد',
                        'price' => 150,
                        'total' => 300,
                    ],
                ],
            ],
        ]);

        $response = $this->sendAnoofyRequest($body);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'result' => AnoofyEventResult::PROCESSED->value,
                ],
            ]);

        $order->refresh();
        $this->assertSame(WcOrderStatus::PENDING_CONFIRMATION, $order->status);
        $this->assertSame('أحمد محمود', $order->call_confirmed_by);
        $this->assertSame('01011223344', $order->customer_phone);
        $this->assertSame('المنصورة', $order->city);
        $this->assertEquals(300, $order->subtotal);

        $this->assertDatabaseMissing('wc_order_items', [
            'wc_order_id' => $order->id,
            'product_id' => $productOld->id,
        ]);
        $this->assertDatabaseHas('wc_order_items', [
            'wc_order_id' => $order->id,
            'product_id' => $productNew->id,
            'quantity' => 2,
        ]);

        Queue::assertPushed(PushStockToWooCommerceJob::class, 2);
    }

    // Case d: order.confirmed لأوردر مش موجود
    public function test_case_d_order_confirmed_not_yet_synced_returns_409_and_no_inbox(): void
    {
        $body = json_encode([
            'schema_version' => 1,
            'event_id' => '22222222-2222-4222-8222-222222222223',
            'event_type' => AnoofyEventType::ORDER_CONFIRMED->value,
            'occurred_at' => '2026-11-04T12:00:00Z',
            'order_version' => 1,
            'data' => [
                'wc_order_id' => 99999,
                'confirmed_at' => '2026-11-04T12:00:00Z',
                'confirmed_by_name' => 'أحمد محمود',
            ],
        ]);

        $response = $this->sendAnoofyRequest($body);

        $response->assertStatus(409)
            ->assertJson([
                'success' => false,
                'error_code' => 'ORDER_NOT_YET_SYNCED',
            ]);

        $this->assertDatabaseMissing('anoofy_inbox_events', [
            'event_id' => '22222222-2222-4222-8222-222222222223',
        ]);
    }

    // Case e: order.confirmed مكرر (نفس event_id)
    public function test_case_e_duplicate_event_returns_duplicate_idempotently(): void
    {
        AnoofyInboxEvent::create([
            'user_id' => $this->owner->id,
            'event_id' => '22222222-2222-4222-8222-222222222224',
            'event_type' => AnoofyEventType::ORDER_CONFIRMED->value,
            'order_version' => 1,
            'result' => AnoofyEventResult::PROCESSED->value,
            'received_at' => now(),
        ]);

        $body = json_encode([
            'schema_version' => 1,
            'event_id' => '22222222-2222-4222-8222-222222222224',
            'event_type' => AnoofyEventType::ORDER_CONFIRMED->value,
            'occurred_at' => '2026-11-04T12:00:00Z',
            'order_version' => 1,
            'data' => [
                'wc_order_id' => 5001,
            ],
        ]);

        $response = $this->sendAnoofyRequest($body);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'result' => AnoofyEventResult::DUPLICATE->value,
                    'reason' => 'already_processed',
                ],
            ]);
    }

    // Case f: order.confirmed قديم (order_version أقل أو يساوي المسجل)
    public function test_case_f_stale_order_version(): void
    {
        $order = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 5002,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'anoofy_order_version' => 3,
            'customer_phone' => '01000000000',
        ]);

        $body = json_encode([
            'schema_version' => 1,
            'event_id' => '22222222-2222-4222-8222-222222222225',
            'event_type' => AnoofyEventType::ORDER_CONFIRMED->value,
            'occurred_at' => '2026-11-04T12:00:00Z',
            'order_version' => 2,
            'data' => [
                'wc_order_id' => 5002,
                'confirmed_at' => '2026-11-04T12:00:00Z',
                'confirmed_by_name' => 'سارة',
                'customer' => ['phone' => '01111111111'],
            ],
        ]);

        $response = $this->sendAnoofyRequest($body);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'result' => AnoofyEventResult::STALE->value,
                ],
            ]);

        $order->refresh();
        $this->assertSame('01000000000', $order->customer_phone);
        $this->assertNull($order->call_confirmed_by);
    }

    // Case g: order.confirmed لتأكيد تم قبل anoofy_connected_at
    public function test_case_g_confirmed_before_connection_ignored(): void
    {
        $order = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 5003,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
        ]);

        $body = json_encode([
            'schema_version' => 1,
            'event_id' => '22222222-2222-4222-8222-222222222226',
            'event_type' => AnoofyEventType::ORDER_CONFIRMED->value,
            'occurred_at' => '2026-11-04T08:00:00Z',
            'order_version' => 1,
            'data' => [
                'wc_order_id' => 5003,
                'confirmed_at' => '2026-11-04T08:00:00Z',
                'confirmed_by_name' => 'سارة',
            ],
        ]);

        $response = $this->sendAnoofyRequest($body);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'result' => AnoofyEventResult::IGNORED->value,
                    'reason' => 'before_connection',
                ],
            ]);

        $order->refresh();
        $this->assertNull($order->call_confirmed_by);
    }

    // Case h: order.confirmed لأوردر حالته مش PENDING_CONFIRMATION
    public function test_case_h_order_not_pending_confirmation_ignored(): void
    {
        $order = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 5004,
            'status' => WcOrderStatus::DISPATCHED,
        ]);

        $body = json_encode([
            'schema_version' => 1,
            'event_id' => '22222222-2222-4222-8222-222222222227',
            'event_type' => AnoofyEventType::ORDER_CONFIRMED->value,
            'occurred_at' => '2026-11-04T12:00:00Z',
            'order_version' => 1,
            'data' => [
                'wc_order_id' => 5004,
                'confirmed_at' => '2026-11-04T12:00:00Z',
                'confirmed_by_name' => 'سارة',
            ],
        ]);

        $response = $this->sendAnoofyRequest($body);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'result' => AnoofyEventResult::IGNORED->value,
                    'reason' => WcOrderStatus::DISPATCHED->value,
                ],
            ]);

        $order->refresh();
        $this->assertNull($order->call_confirmed_by);
    }

    // Case i: توقيع غير صالح
    public function test_case_i_invalid_signature_returns_401(): void
    {
        $body = json_encode(['schema_version' => 1]);
        $response = $this->sendAnoofyRequest($body, customSignature: 'invalid-signature-hex');

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'error_code' => 'INVALID_ANOOFY_SIGNATURE',
            ]);
    }

    // Case j: توقيع قديم (أكتر من 300 ثانية)
    public function test_case_j_expired_timestamp_returns_401(): void
    {
        $body = json_encode(['schema_version' => 1]);
        $response = $this->sendAnoofyRequest($body, timestamp: now()->subSeconds(350)->timestamp);

        $response->assertStatus(401)
            ->assertJson([
                'success' => false,
                'error_code' => 'INVALID_ANOOFY_SIGNATURE',
            ]);
    }

    // Case k: payload غير مطابق للعقد
    public function test_case_k_invalid_payload_returns_422(): void
    {
        $body = json_encode([
            'schema_version' => 999,
            'event_id' => 'not-a-uuid',
        ]);

        $response = $this->sendAnoofyRequest($body);
        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'error_code' => 'INVALID_ANOOFY_PAYLOAD',
            ]);
    }
}
