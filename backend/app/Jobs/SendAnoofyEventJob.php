<?php

namespace App\Jobs;

use App\Contracts\AnoofyOutboundClientInterface;
use App\Enums\AnoofyOutboxStatus;
use App\Enums\QueueName;
use App\Exceptions\Anoofy\AnoofySecurityException;
use App\Models\AnoofyOutboxEvent;
use App\Models\WooCommerceIntegration;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Http\Client\Response;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;
use RuntimeException;
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

    public function queue($queue, $command)
    {
        if ($this->afterCommit && app()->bound('db.transactions') && app('db.transactions')->getPendingTransactions()->isNotEmpty()) {
            return app('db.transactions')->addCallback(
                fn () => $queue->push($command)
            );
        }

        return $queue->push($command);
    }

    public function handle(AnoofyOutboundClientInterface $client): void
    {
        $outbox = AnoofyOutboxEvent::withoutGlobalScopes()->find($this->outboxId);
        if (!$outbox || $outbox->status === AnoofyOutboxStatus::SENT) {
            return;
        }

        $integration = WooCommerceIntegration::withoutGlobalScopes()
            ->where('user_id', $outbox->user_id)
            ->first();

        if ($this->isUnlinked($integration)) {
            $outbox->update(['status' => AnoofyOutboxStatus::FAILED, 'last_error' => 'not_connected']);
            return;
        }

        $response = $this->executeSend($client, $integration, $outbox);
        if ($response !== null) {
            $this->processResponse($outbox, $response);
        }
    }

    private function isUnlinked(?WooCommerceIntegration $integration): bool
    {
        return !$integration
            || !$integration->anoofy_connected_at
            || empty($integration->anoofy_callback_url)
            || empty($integration->anoofy_secret);
    }

    private function executeSend(
        AnoofyOutboundClientInterface $client,
        WooCommerceIntegration $integration,
        AnoofyOutboxEvent $outbox
    ): ?Response {
        try {
            return $client->send($integration, $outbox->payload);
        } catch (AnoofySecurityException $e) {
            $outbox->update(['status' => AnoofyOutboxStatus::FAILED, 'last_error' => 'internal_ip_rejected']);
            $this->fail($e);
            return null;
        } catch (Throwable $e) {
            $outbox->increment('attempts');
            $outbox->update(['last_error' => Str::limit($e->getMessage(), 500)]);
            throw $e;
        }
    }

    private function processResponse(AnoofyOutboxEvent $outbox, Response $response): void
    {
        if ($response->successful()) {
            $outbox->update(['status' => AnoofyOutboxStatus::SENT, 'sent_at' => now(), 'last_error' => null]);
            return;
        }

        $bodySnippet = Str::limit($response->body(), 500);
        $errorMsg = "HTTP {$response->status()}: {$bodySnippet}";

        if ($response->status() === 401 || ($response->clientError() && $response->status() !== 429)) {
            $outbox->update(['status' => AnoofyOutboxStatus::FAILED, 'last_error' => $errorMsg]);
            $this->fail(new RuntimeException("Non-retryable {$errorMsg}"));
            return;
        }

        $outbox->increment('attempts');
        $outbox->update(['last_error' => $errorMsg]);
        throw new RuntimeException("Retryable {$errorMsg}");
    }

    public function failed(?Throwable $exception): void
    {
        $outbox = AnoofyOutboxEvent::withoutGlobalScopes()->find($this->outboxId);
        $outbox?->update(['status' => AnoofyOutboxStatus::FAILED]);
    }
}
