<?php

namespace App\Contracts;

use App\DTOs\AnoofyEnvelope;
use App\DTOs\HandlerOutcome;
use App\Models\WooCommerceIntegration;

interface AnoofyEventHandlerInterface
{
    public function handle(WooCommerceIntegration $integration, AnoofyEnvelope $envelope): HandlerOutcome;
}
