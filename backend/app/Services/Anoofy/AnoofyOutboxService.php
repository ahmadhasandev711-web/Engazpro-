<?php

namespace App\Services\Anoofy;

use App\Enums\AnoofyEventType;
use App\Enums\AnoofyOutboxStatus;
use App\Enums\WcOrderStatus;
use App\Jobs\SendAnoofyEventJob;
use App\Models\AnoofyOutboxEvent;
use App\Models\OnlineOrder;
use App\Models\WooCommerceIntegration;
use Carbon\CarbonImmutable;

class AnoofyOutboxService
{
    public function __construct(
        private readonly AnoofyEnvelopeFactory $envelopeFactory
    ) {}

    public function recordStageChange(OnlineOrder $order, ?WcOrderStatus $previousStatus): ?AnoofyOutboxEvent
    {
        $integration = WooCommerceIntegration::withoutGlobalScopes()
            ->where('user_id', $order->user_id)
            ->first();

        if (!$integration || !$integration->anoofy_connected_at || empty($integration->anoofy_callback_url) || empty($integration->anoofy_secret)) {
            return null;
        }

        $meta = OnlineOrder::withoutGlobalScopes()->whereKey($order->id)->value('platform_meta') ?? [];
        $newVersion = ((int) ($meta['anoofy_outbound_version'] ?? 0)) + 1;
        $meta['anoofy_outbound_version'] = $newVersion;
        OnlineOrder::withoutGlobalScopes()->whereKey($order->id)->update(['platform_meta' => $meta]);

        return $this->createOutboxEvent($order, $this->buildPayload($order, $previousStatus, $newVersion), $newVersion);
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function createOutboxEvent(OnlineOrder $order, array $payload, int $version): AnoofyOutboxEvent
    {
        $outbox = AnoofyOutboxEvent::create([
            'user_id' => $order->user_id,
            'event_id' => $payload['event_id'],
            'event_type' => AnoofyEventType::ORDER_STAGE_CHANGED,
            'online_order_id' => $order->id,
            'wc_order_id' => $order->id,
            'order_version' => $version,
            'payload' => $payload,
            'status' => AnoofyOutboxStatus::PENDING,
            'attempts' => 0,
        ]);

        SendAnoofyEventJob::dispatch($outbox->id)->afterCommit();

        return $outbox;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildPayload(OnlineOrder $order, ?WcOrderStatus $previousStatus, int $version): array
    {
        $data = [
            'wc_order_id' => (int) $order->external_order_id,
            'stage' => $order->status->value,
            'previous_stage' => $previousStatus?->value,
            'changed_at' => CarbonImmutable::now('UTC')->format('Y-m-d\TH:i:s\Z'),
            'branch_name' => $order->branch?->name,
            'courier_name' => $order->courier_name ?: $order->courierParty?->name,
            'tracking_number' => $order->tracking_number,
        ];

        return $this->envelopeFactory->build(
            AnoofyEventType::ORDER_STAGE_CHANGED,
            $version,
            $data
        );
    }
}
