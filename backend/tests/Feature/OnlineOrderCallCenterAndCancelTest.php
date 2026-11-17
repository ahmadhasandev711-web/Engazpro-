<?php

namespace Tests\Feature;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\BranchType;
use App\Enums\EcommercePlatform;
use App\Enums\OnlineOrderCallStatus;
use App\Enums\OrderCancelReason;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Jobs\CancelShopifyOrderJob;
use App\Jobs\SyncOrderStatusToWooCommerceJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\OnlineOrder;
use App\Models\OnlineOrderItem;
use App\Models\Product;
use App\Models\ShopifyIntegration;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\OnlineOrders\OnlineOrderIngestionService;
use App\Services\OnlineOrders\OnlineOrderStockReservationService;
use App\Support\ShopifyGid;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class OnlineOrderCallCenterAndCancelTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private User $cashier;

    private User $mandob;

    private Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'صاحب المتجر',
            'phone' => '01099880011',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER,
            'status' => UserStatus::ACTIVE,
        ]);
        $this->owner->forceFill(['ecommerce_enabled' => true])->save();

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ANNUAL',
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'MAIN',
            'type' => BranchType::STORE,
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->cashier = User::create([
            'name' => 'موظف الكول سنتر',
            'phone' => '01099880022',
            'password' => bcrypt('password123'),
            'role' => UserRole::CASHIER,
            'status' => UserStatus::ACTIVE,
            'owner_id' => $this->owner->id,
            'branch_id' => $this->branch->id,
        ]);

        $this->mandob = User::create([
            'name' => 'مندوب التوصيل',
            'phone' => '01099880033',
            'password' => bcrypt('password123'),
            'role' => UserRole::MANDOB,
            'status' => UserStatus::ACTIVE,
            'owner_id' => $this->owner->id,
            'branch_id' => $this->branch->id,
        ]);

        WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://woo-call.example.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'online_branch_id' => $this->branch->id,
            'is_active' => true,
        ]);
    }

    public function test_log_call_no_answer_and_callback_scheduled_track_attempts_agent_and_keep_reservation(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'تيشيرت قطن',
            'price' => 250,
            'cost_price' => 120,
            'quantity' => 10,
        ]);

        $order = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '501',
            'external_order_number' => '#501',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'total' => '500.00',
        ]);

        OnlineOrderItem::create([
            'user_id' => $this->owner->id,
            'online_order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => '2.00',
        ]);

        // Attempt 1: No Answer by cashier
        $res1 = $this->actingAs($this->cashier)->postJson("/api/online-orders/{$order->id}/log-call", [
            'call_status' => OnlineOrderCallStatus::NO_ANSWER->value,
        ]);
        $res1->assertOk()
            ->assertJsonPath('data.status', WcOrderStatus::PENDING_CONFIRMATION->value)
            ->assertJsonPath('data.call_status', OnlineOrderCallStatus::NO_ANSWER->value)
            ->assertJsonPath('data.call_attempts_count', 1)
            ->assertJsonPath('data.last_call_attempt_by', 'موظف الكول سنتر');

        // Attempt 2: Callback scheduled by owner with notes
        $scheduledAt = now()->addHours(3)->toIso8601String();
        $res2 = $this->actingAs($this->owner)->postJson("/api/online-orders/{$order->id}/log-call", [
            'call_status' => OnlineOrderCallStatus::CALLBACK_SCHEDULED->value,
            'call_scheduled_at' => $scheduledAt,
            'call_notes' => 'العميل طلب الاتصال بعد الساعة 8 مساءً',
        ]);
        $res2->assertOk()
            ->assertJsonPath('data.call_status', OnlineOrderCallStatus::CALLBACK_SCHEDULED->value)
            ->assertJsonPath('data.call_attempts_count', 2)
            ->assertJsonPath('data.last_call_attempt_by', 'صاحب المتجر')
            ->assertJsonPath('data.call_notes', 'العميل طلب الاتصال بعد الساعة 8 مساءً');

        // Stock reservation must remain intact while awaiting confirmation
        $reserved = app(OnlineOrderStockReservationService::class)->reservedQuantity(
            $this->owner->id,
            $product->id,
            null,
            [$this->branch->id]
        );
        $this->assertSame('2.00', $reserved->toDecimalString());
    }

    public function test_no_answer_tab_filters_follow_ups_and_returns_accurate_tab_counts(): void
    {
        OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '601',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'call_status' => null,
            'total' => '100.00',
        ]);

        OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '602',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'call_status' => OnlineOrderCallStatus::NO_ANSWER,
            'call_attempts_count' => 1,
            'last_call_attempt_at' => now(),
            'total' => '200.00',
        ]);

        OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '603',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'call_status' => OnlineOrderCallStatus::CALLBACK_SCHEDULED,
            'call_attempts_count' => 1,
            'call_scheduled_at' => now()->addHour(),
            'last_call_attempt_at' => now(),
            'total' => '300.00',
        ]);

        OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '604',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::CONFIRMED,
            'call_status' => OnlineOrderCallStatus::CONFIRMED,
            'total' => '400.00',
        ]);

        $res = $this->actingAs($this->owner)
            ->getJson('/api/online-orders?status=' . OnlineOrderCallStatus::NO_ANSWER->value);

        $res->assertOk();
        $this->assertCount(2, $res->json('data.data'));
        $this->assertSame('603', $res->json('data.data.0.external_order_id'));
        $this->assertSame('602', $res->json('data.data.1.external_order_id'));

        $this->assertSame(4, $res->json('counts.ALL'));
        $this->assertSame(3, $res->json('counts.' . WcOrderStatus::PENDING_CONFIRMATION->value));
        $this->assertSame(2, $res->json('counts.' . OnlineOrderCallStatus::NO_ANSWER->value));
        $this->assertSame(1, $res->json('counts.' . WcOrderStatus::CONFIRMED->value));
    }

    public function test_cancelling_woocommerce_order_records_reason_releases_stock_and_syncs_platform(): void
    {
        Queue::fake();

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'حذاء رياضي',
            'price' => 500,
            'cost_price' => 300,
            'quantity' => 10,
        ]);

        $order = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '701',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'total' => '500.00',
        ]);

        OnlineOrderItem::create([
            'user_id' => $this->owner->id,
            'online_order_id' => $order->id,
            'product_id' => $product->id,
            'quantity' => '3.00',
        ]);

        $res = $this->actingAs($this->cashier)->postJson("/api/online-orders/{$order->id}/cancel", [
            'reason' => OrderCancelReason::CUSTOMER_REJECTED->value,
            'notes' => 'غير رأيه قبل الشحن',
        ]);

        $res->assertOk()
            ->assertJsonPath('data.status', WcOrderStatus::CANCELLED->value)
            ->assertJsonPath('data.cancel_reason', OrderCancelReason::CUSTOMER_REJECTED->value)
            ->assertJsonPath('data.cancel_notes', 'غير رأيه قبل الشحن');

        $reserved = app(OnlineOrderStockReservationService::class)->reservedQuantity(
            $this->owner->id,
            $product->id,
            null,
            [$this->branch->id]
        );
        $this->assertSame('0.00', $reserved->toDecimalString());

        Queue::assertPushed(SyncOrderStatusToWooCommerceJob::class, function (SyncOrderStatusToWooCommerceJob $job) {
            return $job->userId === $this->owner->id
                && $job->wcOrderId === 701
                && $job->status === 'cancelled';
        });
    }

    public function test_cancelling_shopify_order_dispatches_and_executes_graphql_order_cancel(): void
    {
        Queue::fake([CancelShopifyOrderJob::class]);

        $integration = ShopifyIntegration::create([
            'user_id' => $this->owner->id,
            'shop_domain' => 'callcenter-shop.myshopify.com',
            'access_token' => 'shpat_secret',
            'is_active' => true,
            'auto_sync_stock' => false,
        ]);
        \App\Services\Shopify\ShopifyStockSyncGate::forget($this->owner->id);

        $order = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::SHOPIFY,
            'external_order_id' => '99001122',
            'external_order_number' => '#SH-9901',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::CONFIRMED,
            'total' => '800.00',
        ]);

        $res = $this->actingAs($this->owner)->postJson("/api/online-orders/{$order->id}/cancel", [
            'reason' => OrderCancelReason::DUPLICATE_ORDER->value,
            'notes' => 'طلب مكرر لنفس العميل',
        ]);

        $res->assertOk()
            ->assertJsonPath('data.status', WcOrderStatus::CANCELLED->value)
            ->assertJsonPath('data.cancel_reason', OrderCancelReason::DUPLICATE_ORDER->value);

        Queue::assertPushed(CancelShopifyOrderJob::class, fn (CancelShopifyOrderJob $job) => $job->localOrderId === $order->id);

        $mockGraphql = $this->createMock(ShopifyGraphqlClientInterface::class);
        $mockGraphql->expects($this->once())
            ->method('cancelOrder')
            ->with(
                $this->callback(fn (ShopifyIntegration $int) => $int->id === $integration->id),
                ShopifyGid::toGid('Order', 99001122),
                'OTHER',
                true,
                $this->stringContains('طلب مكرر')
            )
            ->willReturn(['job' => ['id' => 'gid://shopify/Job/1']]);

        $this->app->instance(ShopifyGraphqlClientInterface::class, $mockGraphql);
        $this->app->call([new CancelShopifyOrderJob($this->owner->id, $order->id), 'handle']);
    }

    public function test_mandob_is_forbidden_and_shipped_orders_cannot_be_cancelled(): void
    {
        $order = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '801',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'total' => '150.00',
        ]);

        $this->actingAs($this->mandob)
            ->postJson("/api/online-orders/{$order->id}/log-call", ['call_status' => OnlineOrderCallStatus::NO_ANSWER->value])
            ->assertStatus(403);

        $this->actingAs($this->mandob)
            ->postJson("/api/online-orders/{$order->id}/cancel", ['reason' => OrderCancelReason::WRONG_NUMBER->value])
            ->assertStatus(403);

        $dispatchedOrder = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '802',
            'branch_id' => $this->branch->id,
            'mandob_id' => $this->mandob->id,
            'status' => WcOrderStatus::DISPATCHED,
            'total' => '150.00',
        ]);

        $this->actingAs($this->owner)
            ->postJson("/api/online-orders/{$dispatchedOrder->id}/cancel", ['reason' => OrderCancelReason::CUSTOMER_REJECTED->value])
            ->assertStatus(422);

        $this->actingAs($this->owner)
            ->postJson("/api/online-orders/{$dispatchedOrder->id}/log-call", ['call_status' => OnlineOrderCallStatus::NO_ANSWER->value])
            ->assertStatus(422);
    }

    public function test_platform_webhook_update_preserves_call_center_history(): void
    {
        $order = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '901',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'call_status' => OnlineOrderCallStatus::NO_ANSWER,
            'call_attempts_count' => 3,
            'last_call_attempt_by' => 'سارة',
            'call_notes' => 'لا يرد منذ الصباح',
            'total' => '300.00',
        ]);

        app(OnlineOrderIngestionService::class)->ingest($this->owner, EcommercePlatform::WOOCOMMERCE, [
            'id' => 901,
            'status' => 'processing',
            'total' => '300.00',
            'billing' => ['first_name' => 'أحمد', 'phone' => '01012345678'],
            'line_items' => [],
        ]);

        $fresh = $order->fresh();
        $this->assertSame(OnlineOrderCallStatus::NO_ANSWER, $fresh->call_status);
        $this->assertSame(3, $fresh->call_attempts_count);
        $this->assertSame('سارة', $fresh->last_call_attempt_by);
        $this->assertSame('لا يرد منذ الصباح', $fresh->call_notes);
    }
}
