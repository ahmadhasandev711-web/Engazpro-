<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/**
 * Shared-hosting cron worker. Each run drains the queue for up to 50 seconds.
 * The overlap lock expires after 2 minutes so a killed PHP process cannot
 * block the queue for the default 24 hours. Long jobs stay reserved via
 * retry_after (must stay above the job timeout).
 */
Schedule::command('queue:work --stop-when-empty --max-time=50')
    ->everyMinute()
    ->withoutOverlapping(2);
