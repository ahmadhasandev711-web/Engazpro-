<?php

namespace App\Services\Anoofy;

use App\Enums\AnoofyEventType;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

class AnoofyEnvelopeFactory
{
    /**
     * Build standard Anoofy JSON envelope array.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function build(AnoofyEventType $eventType, int $orderVersion, array $data): array
    {
        return [
            'schema_version' => 1,
            'event_id' => Str::uuid()->toString(),
            'event_type' => $eventType->value,
            'occurred_at' => CarbonImmutable::now('UTC')->format('Y-m-d\TH:i:s\Z'),
            'order_version' => $orderVersion,
            'data' => $data,
        ];
    }
}
