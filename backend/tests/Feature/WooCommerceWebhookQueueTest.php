<?php

namespace Tests\Feature;

use App\Enums\QueueName;
use App\Jobs\ProcessWooCommerceWebhookJob;
use App\Models\Branch;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class WooCommerceWebhookQueueTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $branch;
    protected WooCommerceIntegration $integration;
    protected string $secret = 'test_webhook_secret_123';

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => 'OWNER']);
        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'BR-01',
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->integration = WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://mystore.example.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'webhook_secret' => $this->secret,
            'online_branch_id' => $this->branch->id,
            'is_active' => true,
        ]);
    }

    public function test_order_webhook_dispatches_job_on_realtime_queue_and_returns_202(): void
    {
        Queue::fake();

        $payload = [
            'id' => 9001,
            'status' => 'processing',
            'billing' => [
                'first_name' => 'محمد',
                'last_name' => 'علي',
                'phone' => '01012345678',
            ],
            'line_items' => [],
        ];
        $raw = json_encode($payload);
        $signature = base64_encode(hash_hmac('sha256', $raw, $this->secret, true));

        $response = $this->call(
            'POST',
            "/api/webhooks/woocommerce/{$this->owner->id}",
            [],
            [],
            [],
            [
                'HTTP_X_WC_WEBHOOK_SIGNATURE' => $signature,
                'HTTP_X_WC_WEBHOOK_TOPIC' => 'order.created',
                'CONTENT_TYPE' => 'application/json',
            ],
            $raw
        );

        $response->assertStatus(202);

        Queue::assertPushed(ProcessWooCommerceWebhookJob::class, function ($job) {
            return $job->userId === $this->owner->id
                && $job->topic === 'order.created'
                && $job->payload['id'] === 9001
                && $job->queue === QueueName::WOO_REALTIME->value;
        });
    }

    public function test_ping_webhook_returns_200_and_does_not_dispatch_job(): void
    {
        Queue::fake();

        $payload = ['webhook_id' => 42];
        $raw = json_encode($payload);
        $signature = base64_encode(hash_hmac('sha256', $raw, $this->secret, true));

        $response = $this->call(
            'POST',
            "/api/webhooks/woocommerce/{$this->owner->id}",
            [],
            [],
            [],
            [
                'HTTP_X_WC_WEBHOOK_SIGNATURE' => $signature,
                'HTTP_X_WC_WEBHOOK_TOPIC' => 'action.woocommerce_webhook_ping',
                'CONTENT_TYPE' => 'application/json',
            ],
            $raw
        );

        $response->assertOk();
        Queue::assertNotPushed(ProcessWooCommerceWebhookJob::class);
    }

    public function test_process_webhook_job_executes_incoming_order_sync(): void
    {
        $mockSyncService = \Mockery::mock(\App\Services\WooCommerce\WooCommerceOrderSyncService::class);
        $mockSyncService->shouldReceive('handleIncomingOrder')
            ->once()
            ->withArgs(function ($user, $payload) {
                return $user->id === $this->owner->id && $payload['id'] === 9002;
            })
            ->andReturn(new \App\Models\WcOrder(['id' => 1, 'wc_order_id' => 9002]));

        $job = new ProcessWooCommerceWebhookJob(
            $this->owner->id,
            'order.created',
            ['id' => 9002, 'status' => 'processing']
        );

        $job->handle($mockSyncService);

        $this->assertEquals($this->owner->id, \Illuminate\Support\Facades\Auth::id());
    }
}
