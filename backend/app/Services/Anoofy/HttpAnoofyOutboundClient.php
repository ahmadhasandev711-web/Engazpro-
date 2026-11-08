<?php

namespace App\Services\Anoofy;

use App\Contracts\AnoofyOutboundClientInterface;
use App\Contracts\HostResolver;
use App\Exceptions\Anoofy\AnoofySecurityException;
use App\Models\WooCommerceIntegration;
use App\Support\PublicIpPolicy;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class HttpAnoofyOutboundClient implements AnoofyOutboundClientInterface
{
    public function __construct(
        private readonly HostResolver $hostResolver
    ) {}

    public function send(WooCommerceIntegration $integration, array $payload): Response
    {
        $callbackUrl = (string) $integration->anoofy_callback_url;
        $this->validateCallbackHost($callbackUrl);

        $timestamp = CarbonImmutable::now('UTC')->timestamp;
        $rawBody = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $signature = hash_hmac('sha256', "{$timestamp}.{$rawBody}", (string) $integration->anoofy_secret);

        return Http::timeout(10)->withHeaders([
            'Content-Type' => 'application/json',
            'X-Anoofy-Key-Id' => (string) $integration->anoofy_key_id,
            'X-Anoofy-Timestamp' => (string) $timestamp,
            'X-Anoofy-Signature' => $signature,
        ])->withBody($rawBody, 'application/json')->post($callbackUrl);
    }

    private function validateCallbackHost(string $url): void
    {
        $host = parse_url($url, PHP_URL_HOST);
        if (!$host) {
            throw new AnoofySecurityException('invalid_url_host');
        }

        $ips = $this->hostResolver->resolve($host);
        if (empty($ips)) {
            throw new AnoofySecurityException('unresolvable_host');
        }

        foreach ($ips as $ip) {
            if (!PublicIpPolicy::isPublic($ip)) {
                throw new AnoofySecurityException('internal_ip_rejected');
            }
        }
    }
}
