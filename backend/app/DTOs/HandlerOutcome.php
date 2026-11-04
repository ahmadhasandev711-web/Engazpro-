<?php

namespace App\DTOs;

use App\Enums\AnoofyEventResult;

final readonly class HandlerOutcome
{
    public function __construct(
        public AnoofyEventResult $result,
        public ?string $reason = null,
    ) {
    }
}
