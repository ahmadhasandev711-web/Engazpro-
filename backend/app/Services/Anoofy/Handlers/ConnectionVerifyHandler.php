<?php

namespace App\Services\Anoofy\Handlers;

use App\Contracts\AnoofyEventHandlerInterface;
use App\DTOs\AnoofyEnvelope;
use App\DTOs\HandlerOutcome;
use App\Enums\AnoofyEventResult;
use App\Exceptions\InvalidAnoofyPayloadException;
use App\Models\WooCommerceIntegration;
use App\Rules\PublicHttpsUrl;

class ConnectionVerifyHandler implements AnoofyEventHandlerInterface
{
    public function handle(WooCommerceIntegration $integration, AnoofyEnvelope $envelope): HandlerOutcome
    {
        $siteUrl = (string) ($envelope->data['site_url'] ?? '');
        $callbackUrl = (string) ($envelope->data['callback_url'] ?? '');

        $storeHost = strtolower((string) parse_url((string) $integration->store_url, PHP_URL_HOST));
        $this->validateSiteUrl($siteUrl, $storeHost);
        $this->validateCallbackUrl($callbackUrl, $storeHost);

        $integration->anoofy_callback_url = $callbackUrl;
        if ($integration->anoofy_connected_at === null) {
            $integration->anoofy_connected_at = now();
        }
        $integration->save();

        return new HandlerOutcome(AnoofyEventResult::PROCESSED);
    }

    private function validateSiteUrl(string $siteUrl, string $storeHost): void
    {
        $siteHost = strtolower((string) parse_url($siteUrl, PHP_URL_HOST));
        if (empty($siteHost) || $siteHost !== $storeHost) {
            throw new InvalidAnoofyPayloadException('رابط المتجر site_url لا يطابق رابط المتجر المربوط');
        }
    }

    private function validateCallbackUrl(string $callbackUrl, string $storeHost): void
    {
        $callbackHost = strtolower((string) parse_url($callbackUrl, PHP_URL_HOST));
        if (empty($callbackHost) || $callbackHost !== $storeHost) {
            throw new InvalidAnoofyPayloadException('رابط callback_url يجب أن يكون على نفس نطاق المتجر');
        }

        $validator = validator(
            ['callback_url' => $callbackUrl],
            ['callback_url' => ['required', 'string', app(PublicHttpsUrl::class)]]
        );

        if ($validator->fails()) {
            throw new InvalidAnoofyPayloadException((string) $validator->errors()->first('callback_url'));
        }
    }
}
