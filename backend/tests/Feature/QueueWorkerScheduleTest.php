<?php

namespace Tests\Feature;

use Illuminate\Console\Scheduling\Schedule;
use Tests\TestCase;

class QueueWorkerScheduleTest extends TestCase
{
    public function test_cron_worker_cannot_reclaim_a_running_woocommerce_job(): void
    {
        $event = collect(app(Schedule::class)->events())
            ->first(fn ($event) => str_contains((string) $event->command, 'queue:work'));

        $this->assertNotNull($event);
        $this->assertTrue($event->withoutOverlapping);
        $this->assertSame(2, $event->expiresAt);
        $this->assertGreaterThan(
            900,
            (int) config('queue.connections.database.retry_after')
        );
    }
}
