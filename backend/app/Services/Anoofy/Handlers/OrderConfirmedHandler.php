<?php

namespace App\Services\Anoofy\Handlers;

use App\Contracts\AnoofyEventHandlerInterface;
use App\DTOs\AnoofyEnvelope;
use App\DTOs\HandlerOutcome;
use App\Enums\AnoofyEventResult;
use App\Models\WooCommerceIntegration;

class OrderConfirmedHandler implements AnoofyEventHandlerInterface
{
    public function handle(WooCommerceIntegration $integration, AnoofyEnvelope $envelope): HandlerOutcome
    {
        return new HandlerOutcome(AnoofyEventResult::PROCESSED);
    }
}
