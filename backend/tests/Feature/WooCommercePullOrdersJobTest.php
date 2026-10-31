<?php

namespace Tests\Feature;

use App\Enums\QueueName;
use App\Jobs\PullWooCommerceOrdersJob;
use App\Models\Branch;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class WooCommercePullOrdersJobTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $branch;
    protected WooCommerceIntegration $integration;

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
            'online_branch_id' => $this->branch->id,
            'is_active' => true,
        ]);
    }

    public function test_pull_orders_endpoint_dispatches_job_on_bulk_queue_and_returns_202(): void
    {
        Queue::fake();

        $this->actingAs($this->owner);

        $response = $this->postJson('/api/wc-orders/pull');

        $response->assertStatus(202)
            ->assertJson([
                'success' => true,
                'message' => 'جاري سحب الطلبات في الخلفية.',
            ]);

        Queue::assertPushed(PullWooCommerceOrdersJob::class, function ($job) {
            return $job->accountId === $this->owner->id
                && $job->actingUserId === $this->owner->id
                && $job->queue === QueueName::WOO_BULK->value;
        });
    }
}
