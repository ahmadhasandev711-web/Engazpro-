<?php

namespace App\Services\Shopify;

use App\Exceptions\ShopifyConnectionException;
use App\Jobs\ProcessShopifyWebhookJob;
use App\Models\ShopifyIntegration;
use App\Models\User;
use App\Support\ShopifyGid;
use App\Support\TenantContext;
use Illuminate\Support\Facades\Cache;

class ShopifyWebhookService
{
    private const ACCEPTED_PREFIXES = ['orders/', 'products/', 'refunds/', 'locations/'];

    public function __construct(
        protected ShopifyAuthService $authService
    ) {}

    public function handleIncomingWebhook(
        int $userId,
        string $rawPayload,
        ?string $hmacHeader,
        ?string $topic,
        ?string $shopDomainHeader = null,
        ?string $webhookIdHeader = null
    ): array {
        [$owner, $integration] = $this->authenticateWebhookStore($userId, $rawPayload, $hmacHeader, $shopDomainHeader);

        return TenantContext::runAs($owner->id, fn () => $this->dispatchAuthorizedWebhook($userId, $integration, $rawPayload, $topic, $webhookIdHeader));
    }

    private function dispatchAuthorizedWebhook(
        int $userId,
        ShopifyIntegration $integration,
        string $rawPayload,
        ?string $topic,
        ?string $webhookIdHeader
    ): array {
        $normalizedTopic = strtolower(trim((string) $topic));
        if (!$this->isAcceptedTopic($normalizedTopic)) {
            return ['status' => 200, 'body' => ['message' => "Shopify topic '{$normalizedTopic}' ignored"]];
        }

        if ($this->isDuplicateDelivery($integration->user_id, $webhookIdHeader)) {
            return ['status' => 200, 'body' => ['message' => 'Duplicate Shopify webhook ignored']];
        }

        $payload = json_decode($rawPayload, true);
        if (!is_array($payload)) {
            throw new ShopifyConnectionException('Invalid JSON webhook payload', 400);
        }

        ProcessShopifyWebhookJob::dispatch($userId, $normalizedTopic, $payload);

        return ['status' => 202, 'body' => ['success' => true, 'message' => 'Shopify webhook queued']];
    }

    /**
     * @return array{0: User, 1: ShopifyIntegration}
     */
    private function authenticateWebhookStore(
        int $userId,
        string $rawPayload,
        ?string $hmacHeader,
        ?string $shopDomainHeader
    ): array {
        $integration = ShopifyIntegration::withoutGlobalScopes()
            ->where('user_id', $userId)->where('is_active', true)->first();
        if (!$integration) {
            throw new ShopifyConnectionException('Shopify integration inactive or not found', 404);
        }
        $this->assertValidShopDomainHeader($integration, $shopDomainHeader);

        if (!$this->authService->verifyWebhookSignature($integration, $rawPayload, $hmacHeader)) {
            throw new ShopifyConnectionException('Unauthorized Shopify webhook signature', 401);
        }

        $owner = User::withoutGlobalScopes()->find($userId);
        if (!$owner || !$owner->ecommerce_enabled) {
            throw new ShopifyConnectionException('Store owner not found or e-commerce addon disabled', 403);
        }

        return [$owner, $integration];
    }

    private function assertValidShopDomainHeader(ShopifyIntegration $integration, ?string $shopDomainHeader): void
    {
        if (empty($shopDomainHeader)) {
            if (empty($integration->webhook_secret)) {
                throw new ShopifyConnectionException('Missing Shopify shop domain header', 401);
            }
            return;
        }
        $incoming = ShopifyGid::normalizeShopDomain($shopDomainHeader);
        if ($incoming !== $integration->shop_domain) {
            throw new ShopifyConnectionException('Mismatched Shopify shop domain header', 403);
        }
    }

    private function isAcceptedTopic(string $topic): bool
    {
        foreach (self::ACCEPTED_PREFIXES as $prefix) {
            if (str_starts_with($topic, $prefix)) {
                return true;
            }
        }

        return false;
    }

    private function isDuplicateDelivery(int $accountId, ?string $webhookId): bool
    {
        $cleanId = trim((string) $webhookId);
        if ($cleanId === '') {
            return false;
        }

        return !Cache::add("shopify_wh_seen_{$accountId}_{$cleanId}", true, now()->addHours(24));
    }
}
