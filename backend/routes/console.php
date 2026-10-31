<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/**
 * Shared-hosting cron workers.
 * Realtime queue processes instant stock pushes and order status updates without delay.
 * Bulk queue processes batch product imports and bulk stock pushes without starving realtime events.
 * The overlap lock expires after 2 minutes so a killed PHP process cannot block the queue.
 */
Schedule::command('queue:work --queue=woo-realtime,default --stop-when-empty --max-time=50')
    ->everyMinute()
    ->withoutOverlapping(2)
    ->runInBackground();

Schedule::command('queue:work --queue=woo-bulk --stop-when-empty --max-time=50')
    ->everyMinute()
    ->withoutOverlapping(2)
    ->runInBackground();
