<?php

namespace App\Jobs;

use App\Contracts\AnoofyOutboundClientInterface;
use App\Enums\QueueName;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class SendAnoofyEventJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 6;

    /**
     * @var array<int, int>
     */
    public array $backoff = [60, 300, 900, 3600, 21600];

    public function __construct(public int $outboxId)
    {
        $this->onQueue(QueueName::WOO_REALTIME->value);
    }

    public function uniqueId(): string
    {
        return (string) $this->outboxId;
    }

    public function handle(AnoofyOutboundClientInterface $client): void
    {
        // Full sending implementation in Item 5
    }

    public function failed(?Throwable $exception): void
    {
        // Handled in Item 5
    }
}
