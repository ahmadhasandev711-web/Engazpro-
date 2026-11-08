<?php

namespace Tests\Feature;

use App\DTOs\AnoofyEnvelope;
use App\Enums\AnoofyEventResult;
use App\Enums\AnoofyEventType;
use App\Enums\UserRole;
use App\Enums\WcOrderStatus;
use App\Exceptions\OrderNotYetSyncedException;
use App\Jobs\PushStockToWooCommerceJob;
use App\Models\Product;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WcOrderItem;
use App\Models\WooCommerceIntegration;
use App\Services\Anoofy\Handlers\OrderConfirmedHandler;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\SimulatesHttpContext;
use Tests\TestCase;

class OrderConfirmedHandlerTest extends TestCase
{
    use RefreshDatabase, SimulatesHttpContext;

    private User $user;
    private WooCommerceIntegration $integration;
    private OrderConfirmedHandler $handler;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create(['role' => UserRole::OWNER]);
        $this->actingAs($this->user);
        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->user->id,
            'store_url' => 'https://mystore.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'is_active' => true,
            'anoofy_key_id' => '01JBC4M8R0G1Z6Q9W3X4K7M2P1',
            'anoofy_secret' => 'anoofy-secret-key-1234567890123456',
            'anoofy_connected_at' => CarbonImmutable::parse('2026-11-04T10:00:00Z'),
        ]);

        $this->handler = $this->app->make(OrderConfirmedHandler::class);
    }

    public function test_throws_409_when_order_not_found(): void
    {
        $envelope = new AnoofyEnvelope(
            schemaVersion: 1,
            eventId: '22222222-2222-4222-8222-222222222222',
            eventType: AnoofyEventType::ORDER_CONFIRMED,
            occurredAt: CarbonImmutable::parse('2026-11-04T12:00:00Z'),
            orderVersion: 1,
            data: [
                'wc_order_id' => 9999,
                'confirmed_at' => '2026-11-04T12:00:00Z',
                'confirmed_by_name' => 'سارة أحمد',
            ]
        );

        $this->expectException(OrderNotYetSyncedException::class);
        $this->handler->handle($this->integration, $envelope);
    }

    public function test_returns_stale_when_order_version_is_older_or_equal(): void
    {
        $order = WcOrder::create([
            'user_id' => $this->user->id,
            'wc_order_id' => 5001,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'anoofy_order_version' => 2,
        ]);

        $envelope = new AnoofyEnvelope(
            schemaVersion: 1,
            eventId: '22222222-2222-4222-8222-222222222222',
            eventType: AnoofyEventType::ORDER_CONFIRMED,
            occurredAt: CarbonImmutable::parse('2026-11-04T12:00:00Z'),
            orderVersion: 2,
            data: [
                'wc_order_id' => 5001,
                'confirmed_at' => '2026-11-04T12:00:00Z',
                'confirmed_by_name' => 'سارة أحمد',
            ]
        );

        $outcome = $this->handler->handle($this->integration, $envelope);

        $this->assertSame(AnoofyEventResult::STALE, $outcome->result);
    }

    public function test_returns_ignored_when_confirmed_at_is_before_connected_at(): void
    {
        $order = WcOrder::create([
            'user_id' => $this->user->id,
            'wc_order_id' => 5001,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
        ]);

        $envelope = new AnoofyEnvelope(
            schemaVersion: 1,
            eventId: '22222222-2222-4222-8222-222222222222',
            eventType: AnoofyEventType::ORDER_CONFIRMED,
            occurredAt: CarbonImmutable::parse('2026-11-04T09:00:00Z'),
            orderVersion: 1,
            data: [
                'wc_order_id' => 5001,
                'confirmed_at' => '2026-11-04T09:00:00Z',
                'confirmed_by_name' => 'سارة أحمد',
            ]
        );

        $outcome = $this->handler->handle($this->integration, $envelope);

        $this->assertSame(AnoofyEventResult::IGNORED, $outcome->result);
        $this->assertSame('before_connection', $outcome->reason);
    }

    public function test_returns_ignored_when_order_status_is_not_pending_confirmation(): void
    {
        $order = WcOrder::create([
            'user_id' => $this->user->id,
            'wc_order_id' => 5001,
            'status' => WcOrderStatus::DISPATCHED,
        ]);

        $envelope = new AnoofyEnvelope(
            schemaVersion: 1,
            eventId: '22222222-2222-4222-8222-222222222222',
            eventType: AnoofyEventType::ORDER_CONFIRMED,
            occurredAt: CarbonImmutable::parse('2026-11-04T12:00:00Z'),
            orderVersion: 1,
            data: [
                'wc_order_id' => 5001,
                'confirmed_at' => '2026-11-04T12:00:00Z',
                'confirmed_by_name' => 'سارة أحمد',
            ]
        );

        $outcome = $this->handler->handle($this->integration, $envelope);

        $this->assertSame(AnoofyEventResult::IGNORED, $outcome->result);
        $this->assertSame(WcOrderStatus::DISPATCHED->value, $outcome->reason);
    }

    public function test_successfully_processes_confirmation_and_updates_fields(): void
    {
        $order = WcOrder::create([
            'user_id' => $this->user->id,
            'wc_order_id' => 5001,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'customer_phone' => '01000000000',
            'customer_address' => 'قديم',
        ]);

        $envelope = new AnoofyEnvelope(
            schemaVersion: 1,
            eventId: '22222222-2222-4222-8222-222222222222',
            eventType: AnoofyEventType::ORDER_CONFIRMED,
            occurredAt: CarbonImmutable::parse('2026-11-04T12:05:00Z'),
            orderVersion: 1,
            data: [
                'wc_order_id' => 5001,
                'confirmed_at' => '2026-11-04T12:05:00Z',
                'confirmed_by_name' => 'سارة أحمد',
                'customer' => [
                    'phone' => '01011223344',
                    'address_1' => '15 شارع النصر',
                    'address_2' => 'شقة 4',
                    'city' => 'مدينة نصر',
                    'state' => 'القاهرة',
                ],
            ]
        );

        $outcome = $this->handler->handle($this->integration, $envelope);

        $this->assertSame(AnoofyEventResult::PROCESSED, $outcome->result);

        $order->refresh();
        $this->assertSame(WcOrderStatus::PENDING_CONFIRMATION, $order->status);
        $this->assertSame('سارة أحمد', $order->call_confirmed_by);
        $this->assertSame(1, $order->anoofy_order_version);
        $this->assertSame('01011223344', $order->customer_phone);
        $this->assertSame('15 شارع النصر - شقة 4', $order->customer_address);
        $this->assertSame('مدينة نصر', $order->city);
        $this->assertSame('القاهرة', $order->governorate);
        $this->assertNotNull($order->call_confirmed_at);
    }

    public function test_updates_line_items_and_dispatches_stock_push(): void
    {
        Queue::fake();

        $productOld = Product::create([
            'user_id' => $this->user->id,
            'name' => 'قديم',
            'wc_product_id' => 801,
            'price' => 100,
            'cost_price' => 50,
        ]);
        $productNew = Product::create([
            'user_id' => $this->user->id,
            'name' => 'قميص قطني',
            'wc_product_id' => 901,
            'price' => 100,
            'cost_price' => 50,
        ]);

        $order = WcOrder::create([
            'user_id' => $this->user->id,
            'wc_order_id' => 5001,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'subtotal' => 100,
            'total' => 100,
        ]);

        WcOrderItem::create([
            'user_id' => $this->user->id,
            'wc_order_id' => $order->id,
            'product_id' => $productOld->id,
            'product_variant_id' => null,
            'wc_product_id' => 801,
            'wc_variation_id' => null,
            'quantity' => 1,
        ]);

        $envelope = new AnoofyEnvelope(
            schemaVersion: 1,
            eventId: '33333333-3333-4333-8333-333333333333',
            eventType: AnoofyEventType::ORDER_CONFIRMED,
            occurredAt: CarbonImmutable::parse('2026-11-04T12:05:00Z'),
            orderVersion: 2,
            data: [
                'wc_order_id' => 5001,
                'confirmed_at' => '2026-11-04T12:05:00Z',
                'confirmed_by_name' => 'سارة أحمد',
                'line_items' => [
                    [
                        'wc_product_id' => 901,
                        'wc_variation_id' => null,
                        'quantity' => 3,
                        'name' => 'قميص قطني',
                        'price' => 100,
                        'total' => 300,
                    ],
                ],
            ]
        );

        $outcome = $this->handler->handle($this->integration, $envelope);

        $this->assertSame(AnoofyEventResult::PROCESSED, $outcome->result);

        $order->refresh();
        $this->assertEquals(300, $order->subtotal);
        $this->assertEquals(300, $order->total);

        // Old item removed, new item created
        $this->assertDatabaseMissing('wc_order_items', [
            'wc_order_id' => $order->id,
            'product_id' => $productOld->id,
        ]);
        $this->assertDatabaseHas('wc_order_items', [
            'wc_order_id' => $order->id,
            'product_id' => $productNew->id,
            'quantity' => 3,
        ]);

        // Both products dispatched (old and new)
        Queue::assertPushed(PushStockToWooCommerceJob::class, function ($job) use ($productOld) {
            return $job->productId === $productOld->id;
        });
        Queue::assertPushed(PushStockToWooCommerceJob::class, function ($job) use ($productNew) {
            return $job->productId === $productNew->id;
        });
    }
}
