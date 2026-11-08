<?php

namespace Tests\Feature;

use App\Enums\AnoofyEventType;
use App\Enums\AnoofyOutboxStatus;
use App\Enums\PartyType;
use App\Enums\UserRole;
use App\Enums\WcOrderStatus;
use App\Jobs\SendAnoofyEventJob;
use App\Models\AnoofyOutboxEvent;
use App\Models\Branch;
use App\Models\Party;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WooCommerceIntegration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\Concerns\SimulatesHttpContext;
use Tests\TestCase;

class AnoofyOutboxStageChangeTest extends TestCase
{
    use RefreshDatabase, SimulatesHttpContext;

    private User $owner;
    private Branch $branch;
    private WooCommerceIntegration $integration;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSimulatesHttpContext();

        $this->owner = User::factory()->create(['role' => UserRole::OWNER]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ANNUAL',
            'price' => 1000,
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'MAIN',
            'is_main' => true,
        ]);

        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://mystore.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'webhook_secret' => 'wh_secret_test_456',
            'is_active' => true,
            'anoofy_key_id' => '01AN00FYK3Y1D0000000000000',
            'anoofy_secret' => '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
            'anoofy_callback_url' => 'https://mystore.com/wp-json/anoofy/v1/callback',
            'anoofy_connected_at' => now(),
        ]);
    }

    private function createPendingOrder(int $wcOrderId = 9001): WcOrder
    {
        return WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => $wcOrderId,
            'order_date' => now(),
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'subtotal' => 300,
            'total' => 300,
            'customer_name' => 'محمد سعيد',
            'customer_phone' => '01012345678',
            'customer_address' => 'شارع التحرير',
            'city' => 'القاهرة',
            'governorate' => 'القاهرة',
        ]);
    }

    public function test_case_a_confirm_order_and_dispatch_courier_records_outbox_events_with_incrementing_versions(): void
    {
        Queue::fake([SendAnoofyEventJob::class]);

        $order = $this->createPendingOrder(9001);

        // 1. Confirm order via API -> version 1
        $response = $this->actingAs($this->owner)->postJson("/api/wc-orders/{$order->id}/confirm", [
            'branch_id' => $this->branch->id,
            'force' => true,
        ]);
        $response->assertStatus(200);

        $outbox1 = AnoofyOutboxEvent::withoutGlobalScopes()
            ->where('wc_order_id', $order->id)
            ->where('order_version', 1)
            ->first();

        $this->assertNotNull($outbox1, 'Outbox event version 1 must be created on confirmation');
        $this->assertSame(AnoofyEventType::ORDER_STAGE_CHANGED, $outbox1->event_type);
        $this->assertSame(AnoofyOutboxStatus::PENDING, $outbox1->status);
        $this->assertSame(WcOrderStatus::CONFIRMED->value, $outbox1->payload['data']['stage']);
        $this->assertSame(WcOrderStatus::PENDING_CONFIRMATION->value, $outbox1->payload['data']['previous_stage']);
        $this->assertSame($this->branch->name, $outbox1->payload['data']['branch_name']);

        Queue::assertPushed(SendAnoofyEventJob::class, function ($job) use ($outbox1) {
            return $job->outboxId === $outbox1->id;
        });

        // 2. Dispatch to courier via API -> version 2
        $courier = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'شركة أرامكس',
            'type' => PartyType::COURIER->value,
        ]);

        $dispatchResponse = $this->actingAs($this->owner)->postJson("/api/wc-orders/{$order->id}/dispatch-courier", [
            'courier_party_id' => $courier->id,
            'courier_name' => 'شركة أرامكس',
            'tracking_number' => 'ARAMEX-123456',
        ]);
        $dispatchResponse->assertStatus(200);

        $outbox2 = AnoofyOutboxEvent::withoutGlobalScopes()
            ->where('wc_order_id', $order->id)
            ->where('order_version', 2)
            ->first();

        $this->assertNotNull($outbox2, 'Outbox event version 2 must be created on dispatch');
        $this->assertSame(WcOrderStatus::SHIPPED_VIA_COURIER->value, $outbox2->payload['data']['stage']);
        $this->assertSame(WcOrderStatus::CONFIRMED->value, $outbox2->payload['data']['previous_stage']);
        $this->assertSame('شركة أرامكس', $outbox2->payload['data']['courier_name']);
        $this->assertSame('ARAMEX-123456', $outbox2->payload['data']['tracking_number']);

        Queue::assertPushed(SendAnoofyEventJob::class, function ($job) use ($outbox2) {
            return $job->outboxId === $outbox2->id;
        });
    }

    public function test_case_b_unconnected_or_missing_callback_does_not_create_outbox_event_or_job(): void
    {
        Queue::fake([SendAnoofyEventJob::class]);

        $this->integration->update(['anoofy_connected_at' => null]);

        $order = $this->createPendingOrder(9002);

        $this->actingAs($this->owner)->postJson("/api/wc-orders/{$order->id}/confirm", [
            'branch_id' => $this->branch->id,
            'force' => true,
        ])->assertStatus(200);

        $this->assertSame(0, AnoofyOutboxEvent::withoutGlobalScopes()->where('wc_order_id', $order->id)->count());
        Queue::assertNothingPushed();
    }

    public function test_case_c_transaction_rollback_and_commit_timing_with_real_database_queue(): void
    {
        config(['queue.default' => 'database']);
        Queue::setDefaultDriver('database');

        $order1 = $this->createPendingOrder(9003);

        // 1. Rollback scenario: inside transaction status changes, but rollback happens
        try {
            DB::transaction(function () use ($order1) {
                $order1->update(['status' => WcOrderStatus::CONFIRMED]);
                $this->assertDatabaseCount('jobs', 0);
                throw new \RuntimeException('Intentional rollback');
            });
        } catch (\RuntimeException $e) {
            if ($e instanceof \PHPUnit\Framework\AssertionFailedError) {
                throw $e;
            }
        }

        if (app()->bound('db.transactions')) {
            app('db.transactions')->getCommittedTransactions()->map->executeCallbacks();
        }

        $this->assertDatabaseCount('jobs', 0);
        $this->assertDatabaseCount('anoofy_outbox_events', 0);

        // 2. Commit scenario: inside transaction jobs is 0, post-commit jobs is 1
        $order2 = $this->createPendingOrder(9004);
        DB::transaction(function () use ($order2) {
            $order2->update(['status' => WcOrderStatus::CONFIRMED]);
            $this->assertDatabaseCount('jobs', 0);
        });

        if (app()->bound('db.transactions')) {
            app('db.transactions')->getCommittedTransactions()->map->executeCallbacks();
        }

        $this->assertDatabaseCount('jobs', 1);
        $this->assertDatabaseCount('anoofy_outbox_events', 1);

        $jobRow = DB::table('jobs')->first();
        $this->assertNotNull($jobRow);
        $this->assertStringContainsString('SendAnoofyEventJob', (string) $jobRow->payload);
    }

    public function test_case_h_cancellation_via_real_wc_webhook_records_cancelled_stage_in_outbox(): void
    {
        Queue::fake([SendAnoofyEventJob::class]);

        $order = $this->createPendingOrder(9004);

        $wcPayload = [
            'id' => 9004,
            'status' => 'cancelled',
            'date_created_gmt' => '2026-11-04T12:00:00',
            'billing' => ['phone' => '01012345678'],
            'shipping' => ['phone' => '01012345678'],
            'line_items' => [],
            'total' => '300.00',
        ];

        $raw = json_encode($wcPayload, JSON_UNESCAPED_UNICODE);
        $sig = base64_encode(hash_hmac('sha256', $raw, (string) $this->integration->webhook_secret, true));

        $this->call(
            'POST',
            "/api/webhooks/woocommerce/{$this->owner->id}",
            [],
            [],
            [],
            [
                'HTTP_X_WC_WEBHOOK_SIGNATURE' => $sig,
                'HTTP_X_WC_WEBHOOK_TOPIC' => 'order.updated',
                'CONTENT_TYPE' => 'application/json',
            ],
            $raw
        )->assertStatus(202);

        $outbox = AnoofyOutboxEvent::withoutGlobalScopes()
            ->where('wc_order_id', $order->id)
            ->first();

        $this->assertNotNull($outbox);
        $this->assertSame(WcOrderStatus::CANCELLED->value, $outbox->payload['data']['stage']);
        $this->assertSame(WcOrderStatus::PENDING_CONFIRMATION->value, $outbox->payload['data']['previous_stage']);
        Queue::assertPushed(SendAnoofyEventJob::class);
    }

    public function test_case_i_observer_does_not_trigger_recursively_on_outbound_version_increment(): void
    {
        Queue::fake([SendAnoofyEventJob::class]);

        $order = $this->createPendingOrder(9005);

        // Transition once to CONFIRMED
        $order->update(['status' => WcOrderStatus::CONFIRMED]);

        $this->assertSame(1, AnoofyOutboxEvent::withoutGlobalScopes()->where('wc_order_id', $order->id)->count());
        Queue::assertPushed(SendAnoofyEventJob::class, 1);
    }

    public function test_amendment_1_consecutive_stage_changes_mutates_only_allowed_columns_in_wc_orders(): void
    {
        Queue::fake([SendAnoofyEventJob::class]);

        $order = $this->createPendingOrder(9006);
        $before = $order->fresh()->getAttributes();

        // 1. Transition to CONFIRMED
        $order->update([
            'status' => WcOrderStatus::CONFIRMED,
            'branch_id' => $this->branch->id,
        ]);

        $outbox1 = AnoofyOutboxEvent::withoutGlobalScopes()
            ->where('wc_order_id', $order->id)
            ->where('order_version', 1)
            ->first();
        $this->assertNotNull($outbox1);
        $this->assertSame(1, (int) $order->fresh()->anoofy_outbound_version);

        // 2. Transition to PREPARING
        $order->update(['status' => WcOrderStatus::PREPARING]);

        $outbox2 = AnoofyOutboxEvent::withoutGlobalScopes()
            ->where('wc_order_id', $order->id)
            ->where('order_version', 2)
            ->first();
        $this->assertNotNull($outbox2);
        $this->assertSame(2, (int) $order->fresh()->anoofy_outbound_version);

        $after = $order->fresh()->getAttributes();

        $allowedChanges = [
            'status',
            'branch_id',
            'anoofy_outbound_version',
            'updated_at',
        ];

        foreach ($before as $key => $val) {
            if (!in_array($key, $allowedChanges, true)) {
                $this->assertEquals($val, $after[$key], "Column {$key} must not be mutated during stage transitions.");
            }
        }
    }
}
