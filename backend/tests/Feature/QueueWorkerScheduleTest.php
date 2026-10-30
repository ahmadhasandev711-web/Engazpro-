<?php

namespace Tests\Feature;

use App\Enums\QueueName;
use App\Jobs\ImportWooCommerceProductsJob;
use App\Jobs\PushAllWooCommerceStocksJob;
use App\Jobs\PushStockToWooCommerceJob;
use App\Jobs\SyncOrderStatusToWooCommerceJob;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class QueueWorkerScheduleTest extends TestCase
{
    public function test_cron_worker_cannot_reclaim_a_running_woocommerce_job(): void
    {
        $events = collect(app(Schedule::class)->events())
            ->filter(fn ($event) => str_contains((string) $event->command, 'queue:work'));

        $this->assertCount(2, $events, 'يجب جدولة عاملين مستقلين لطابوري realtime و bulk');

        $realtimeEvent = $events->first(fn ($e) => str_contains((string) $e->command, '--queue=woo-realtime,default'));
        $bulkEvent = $events->first(fn ($e) => str_contains((string) $e->command, '--queue=woo-bulk'));

        $this->assertNotNull($realtimeEvent, 'عامل woo-realtime,default غير موجود في الجدولة');
        $this->assertNotNull($bulkEvent, 'عامل woo-bulk غير موجود في الجدولة');

        $this->assertTrue($realtimeEvent->withoutOverlapping);
        $this->assertSame(2, $realtimeEvent->expiresAt);

        $this->assertTrue($bulkEvent->withoutOverlapping);
        $this->assertSame(2, $bulkEvent->expiresAt);

        $this->assertGreaterThan(
            900,
            (int) config('queue.connections.database.retry_after')
        );
    }

    public function test_woocommerce_jobs_are_dispatched_to_the_correct_queues(): void
    {
        Queue::fake();

        PushStockToWooCommerceJob::dispatch(1, 10, null);
        Queue::assertPushedOn(QueueName::WOO_REALTIME->value, PushStockToWooCommerceJob::class);

        SyncOrderStatusToWooCommerceJob::dispatch(1, 101, 'completed');
        Queue::assertPushedOn(QueueName::WOO_REALTIME->value, SyncOrderStatusToWooCommerceJob::class);

        ImportWooCommerceProductsJob::dispatch(1, 1, false);
        Queue::assertPushedOn(QueueName::WOO_BULK->value, ImportWooCommerceProductsJob::class);

        PushAllWooCommerceStocksJob::dispatch(1, 1);
        Queue::assertPushedOn(QueueName::WOO_BULK->value, PushAllWooCommerceStocksJob::class);
    }
}

