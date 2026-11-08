<?php

namespace Tests\Feature;

use App\Contracts\AnoofyOutboundClientInterface;
use App\Contracts\HostResolver;
use App\Enums\AnoofyEventType;
use App\Enums\AnoofyOutboxStatus;
use App\Enums\UserRole;
use App\Enums\WcOrderStatus;
use App\Jobs\SendAnoofyEventJob;
use App\Models\AnoofyOutboxEvent;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WooCommerceIntegration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\SimulatesHttpContext;
use Tests\TestCase;

class SendAnoofyEventJobTest extends TestCase
{
    use RefreshDatabase, SimulatesHttpContext;

    private User $owner;
    private WcOrder $order;
    private WooCommerceIntegration $integration;
    private AnoofyOutboxEvent $outbox;

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

        $this->order = WcOrder::create([
            'user_id' => $this->owner->id,
            'wc_order_id' => 8001,
            'order_date' => now(),
            'status' => WcOrderStatus::CONFIRMED,
            'subtotal' => 150,
            'total' => 150,
        ]);

        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://mystore.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'is_active' => true,
            'anoofy_key_id' => '01AN00FYK3Y1D0000000000000',
            'anoofy_secret' => '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
            'anoofy_callback_url' => 'https://mystore.com/wp-json/anoofy/v1/callback',
            'anoofy_connected_at' => now(),
        ]);

        $this->outbox = AnoofyOutboxEvent::create([
            'user_id' => $this->owner->id,
            'event_id' => '44444444-4444-4444-8444-444444444444',
            'event_type' => AnoofyEventType::ORDER_STAGE_CHANGED,
            'wc_order_id' => $this->order->id,
            'order_version' => 1,
            'payload' => [
                'schema_version' => 1,
                'event_id' => '44444444-4444-4444-8444-444444444444',
                'event_type' => AnoofyEventType::ORDER_STAGE_CHANGED->value,
                'occurred_at' => now()->toIso8601String(),
                'order_version' => 1,
                'data' => [
                    'wc_order_id' => 8001,
                    'stage' => WcOrderStatus::CONFIRMED->value,
                    'previous_stage' => WcOrderStatus::PENDING_CONFIRMATION->value,
                    'changed_at' => now()->toIso8601String(),
                ],
            ],
            'status' => AnoofyOutboxStatus::PENDING,
            'attempts' => 0,
        ]);
    }

    public function test_case_d_successful_send_marks_outbox_sent_and_verifies_signature(): void
    {
        Http::fake([
            'https://mystore.com/*' => Http::response(['success' => true, 'data' => ['result' => 'processed']], 200),
        ]);

        $fakeResolver = new class implements HostResolver {
            public function resolve(string $host): array
            {
                return ['93.184.216.34'];
            }
        };
        $this->app->instance(HostResolver::class, $fakeResolver);

        $job = new SendAnoofyEventJob($this->outbox->id);
        $job->handle(app(AnoofyOutboundClientInterface::class));

        $this->outbox->refresh();
        $this->assertSame(AnoofyOutboxStatus::SENT, $this->outbox->status);
        $this->assertNotNull($this->outbox->sent_at);
        $this->assertNull($this->outbox->last_error);

        Http::assertSent(function ($request) {
            $headers = $request->headers();
            $kid = $headers['X-Anoofy-Key-Id'][0] ?? null;
            $ts = $headers['X-Anoofy-Timestamp'][0] ?? null;
            $sig = $headers['X-Anoofy-Signature'][0] ?? null;

            $this->assertSame($this->integration->anoofy_key_id, $kid);
            $this->assertNotNull($ts);

            $rawBody = $request->body();
            $expectedSig = hash_hmac('sha256', "{$ts}.{$rawBody}", (string) $this->integration->anoofy_secret);

            return hash_equals($expectedSig, (string) $sig);
        });
    }

    public function test_case_e1_500_throws_exception_increments_attempts_and_stays_pending(): void
    {
        $fakeResolver = new class implements HostResolver {
            public function resolve(string $host): array
            {
                return ['93.184.216.34'];
            }
        };
        $this->app->instance(HostResolver::class, $fakeResolver);

        Http::fake([
            'https://mystore.com/*' => Http::response(['error' => 'server error'], 500),
        ]);

        $job = new SendAnoofyEventJob($this->outbox->id);

        try {
            $job->handle(app(AnoofyOutboundClientInterface::class));
            $this->fail('Expected exception for 500 retry');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('500', $e->getMessage());
        }

        $this->outbox->refresh();
        $this->assertSame(AnoofyOutboxStatus::PENDING, $this->outbox->status);
        $this->assertSame(1, $this->outbox->attempts);
        $this->assertStringContainsString('500', (string) $this->outbox->last_error);
    }

    public function test_case_e2_429_throws_exception_for_retry(): void
    {
        $fakeResolver = new class implements HostResolver {
            public function resolve(string $host): array
            {
                return ['93.184.216.34'];
            }
        };
        $this->app->instance(HostResolver::class, $fakeResolver);

        Http::fake([
            'https://mystore.com/*' => Http::response(['error' => 'too many requests'], 429),
        ]);

        $job = new SendAnoofyEventJob($this->outbox->id);

        try {
            $job->handle(app(AnoofyOutboundClientInterface::class));
            $this->fail('Expected exception for 429 retry');
        } catch (\RuntimeException $e) {
            $this->assertStringContainsString('429', $e->getMessage());
        }

        $this->outbox->refresh();
        $this->assertSame(1, $this->outbox->attempts);
        $this->assertStringContainsString('429', (string) $this->outbox->last_error);
    }

    public function test_case_e3_401_fails_permanently_without_retry(): void
    {
        $fakeResolver = new class implements HostResolver {
            public function resolve(string $host): array
            {
                return ['93.184.216.34'];
            }
        };
        $this->app->instance(HostResolver::class, $fakeResolver);

        Http::fake([
            'https://mystore.com/*' => Http::response(['error' => 'unauthorized'], 401),
        ]);

        $job = new SendAnoofyEventJob($this->outbox->id);
        $job->handle(app(AnoofyOutboundClientInterface::class));

        $this->outbox->refresh();
        $this->assertSame(AnoofyOutboxStatus::FAILED, $this->outbox->status);
        $this->assertStringContainsString('401', (string) $this->outbox->last_error);
    }

    public function test_case_f_unlinked_integration_before_send_marks_outbox_failed_without_http(): void
    {
        Http::fake();

        $this->integration->update(['anoofy_connected_at' => null]);

        $job = new SendAnoofyEventJob($this->outbox->id);
        $job->handle(app(AnoofyOutboundClientInterface::class));

        $this->outbox->refresh();
        $this->assertSame(AnoofyOutboxStatus::FAILED, $this->outbox->status);
        $this->assertSame('not_connected', $this->outbox->last_error);
        Http::assertNothingSent();
    }

    public function test_case_g_callback_host_resolving_to_internal_ip_marks_outbox_failed_without_http(): void
    {
        Http::fake();

        $internalResolver = new class implements HostResolver {
            public function resolve(string $host): array
            {
                return ['127.0.0.1'];
            }
        };
        $this->app->instance(HostResolver::class, $internalResolver);

        $job = new SendAnoofyEventJob($this->outbox->id);
        $job->handle(app(AnoofyOutboundClientInterface::class));

        $this->outbox->refresh();
        $this->assertSame(AnoofyOutboxStatus::FAILED, $this->outbox->status);
        $this->assertSame('internal_ip_rejected', $this->outbox->last_error);
        Http::assertNothingSent();
    }
}
