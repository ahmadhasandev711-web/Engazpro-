<?php

namespace App\Contracts;

use App\Models\WooCommerceIntegration;
use Illuminate\Http\Client\Response;

interface AnoofyOutboundClientInterface
{
    /**
     * Send outbound Anoofy payload to integration callback URL.
     *
     * @param array<string, mixed> $payload
     */
    public function send(WooCommerceIntegration $integration, array $payload): Response;
}
