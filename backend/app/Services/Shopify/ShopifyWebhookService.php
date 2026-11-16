<?php

namespace App\Services\Shopify;

use App\Exceptions\ShopifyConnectionException;
use App\Jobs\ProcessShopifyWebhookJob;
use App\Models\ShopifyIntegration;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

class ShopifyWebhookService
{
    public function __construct(
        protected ShopifyAuthService $authService
    ) {}

    public function handleIncomingWebhook(int $userId, string $rawPayload, ?string $hmacHeader, ?string $topic): array
    {
        $owner = $this->authenticateWebhookStore($userId, $rawPayload, $hmacHeader);
        Auth::setUser($owner);

        $normalizedTopic = strtolower(trim((string) $topic));
        if (!str_starts_with($normalizedTopic, 'orders/') && !str_starts_with($normalizedTopic, 'products/')) {
            return ['status' => 200, 'body' => ['message' => "Shopify topic '{$normalizedTopic}' ignored"]];
        }

        $payload = json_decode($rawPayload, true);
        if (!is_array($payload)) {
            throw new ShopifyConnectionException('Invalid JSON webhook payload', 400);
        }
        ProcessShopifyWebhookJob::dispatch($userId, $normalizedTopic, $payload);

        return ['status' => 202, 'body' => ['success' => true, 'message' => 'Shopify webhook queued']];
    }

    private function authenticateWebhookStore(int $userId, string $rawPayload, ?string $hmacHeader): User
    {
        $integration = ShopifyIntegration::withoutGlobalScopes()
            ->where('user_id', $userId)->where('is_active', true)->first();
        if (!$integration) {
            throw new ShopifyConnectionException('Shopify integration inactive or not found', 404);
        }
        if (!$this->authService->verifyWebhookHmac($rawPayload, $hmacHeader, $integration->webhook_secret)) {
            throw new ShopifyConnectionException('Unauthorized Shopify webhook signature', 401);
        }

        return User::withoutGlobalScopes()->find($userId)
            ?? throw new ShopifyConnectionException('Store owner not found', 404);
    }
}
