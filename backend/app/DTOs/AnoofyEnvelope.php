<?php

namespace App\DTOs;

use App\Enums\AnoofyEventType;
use Carbon\CarbonImmutable;

final readonly class AnoofyEnvelope
{
    public function __construct(
        public int $schemaVersion,
        public string $eventId,
        public AnoofyEventType $eventType,
        public CarbonImmutable $occurredAt,
        public ?int $orderVersion,
        public array $data,
    ) {
    }
}
