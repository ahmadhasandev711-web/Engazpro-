<?php

namespace App\Services\Anoofy;

use App\Contracts\AnoofyEventHandlerInterface;
use App\Contracts\AnoofySignatureVerifierInterface;
use App\DTOs\AnoofyEnvelope;
use App\DTOs\HandlerOutcome;
use App\Enums\AnoofyEventResult;
use App\Enums\AnoofyEventType;
use App\Exceptions\AnoofyNotConnectedException;
use App\Exceptions\InvalidAnoofyPayloadException;
use App\Exceptions\InvalidAnoofySignatureException;
use App\Models\AnoofyInboxEvent;
use App\Models\WooCommerceIntegration;
use App\Support\TenantContext;
use Illuminate\Support\Facades\DB;

class AnoofyInboundService
{
    public function __construct(
        private readonly AnoofySignatureVerifierInterface $verifier,
        private readonly AnoofyEnvelopeParser $parser,
        private readonly AnoofyHandlerRegistry $registry,
    ) {
    }

    public function receive(string $kid, int $timestamp, string $signature, string $rawBody): array
    {
        $integration = $this->findIntegration($kid);
        $this->verifyReplayWindow($timestamp);
        $this->verifySignature($integration, $timestamp, $signature, $rawBody);

        $envelope = $this->parser->parse($rawBody);

        if ($envelope->eventType !== AnoofyEventType::CONNECTION_VERIFY && $integration->anoofy_connected_at === null) {
            throw new AnoofyNotConnectedException('متجر أنوفي غير متصل بعد');
        }

        return TenantContext::runAs($integration->user_id, function () use ($integration, $envelope) {
            if ($this->isDuplicate($integration->user_id, $envelope->eventId)) {
                return ['result' => AnoofyEventResult::DUPLICATE->value, 'reason' => 'already_processed'];
            }

            return $this->processAndRecord($integration, $envelope);
        });
    }

    private function findIntegration(string $kid): WooCommerceIntegration
    {
        if (empty($kid)) {
            throw new AnoofyNotConnectedException();
        }

        $integration = WooCommerceIntegration::withoutGlobalScopes()->where('anoofy_key_id', $kid)->first();
        if ($integration === null || empty($integration->anoofy_secret)) {
            throw new AnoofyNotConnectedException();
        }

        return $integration;
    }

    private function verifyReplayWindow(int $timestamp): void
    {
        $window = (int) config('pos.anoofy.replay_window_seconds', 300);
        if (abs(now()->timestamp - $timestamp) > $window) {
            throw new InvalidAnoofySignatureException('انتهت صلاحية توقيع الطلب');
        }
    }

    private function verifySignature(
        WooCommerceIntegration $integration,
        int $timestamp,
        string $signature,
        string $rawBody
    ): void {
        if (!$this->verifier->verify($integration->anoofy_secret, $timestamp, $rawBody, $signature)) {
            throw new InvalidAnoofySignatureException();
        }
    }

    private function isDuplicate(int $userId, string $eventId): bool
    {
        return AnoofyInboxEvent::withoutGlobalScopes()
            ->where('user_id', $userId)
            ->where('event_id', $eventId)
            ->exists();
    }

    private function processAndRecord(WooCommerceIntegration $integration, AnoofyEnvelope $envelope): array
    {
        $handler = $this->registry->get($envelope->eventType);

        return DB::transaction(function () use ($handler, $integration, $envelope) {
            $outcome = $handler->handle($integration, $envelope);

            AnoofyInboxEvent::create([
                'user_id' => $integration->user_id,
                'event_id' => $envelope->eventId,
                'event_type' => $envelope->eventType->value,
                'order_version' => $envelope->orderVersion,
                'result' => $outcome->result->value,
                'reason' => $outcome->reason,
                'received_at' => now(),
            ]);

            return array_filter([
                'result' => $outcome->result->value,
                'reason' => $outcome->reason,
            ], fn ($v) => $v !== null);
        });
    }
}
