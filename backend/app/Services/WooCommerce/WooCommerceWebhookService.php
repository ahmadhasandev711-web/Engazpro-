<?php

namespace App\Services\WooCommerce;

use App\Exceptions\WooCommerceConnectionException;
use App\Jobs\ProcessWooCommerceWebhookJob;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\SubscriptionGate;
use App\Support\TenantContext;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class WooCommerceWebhookService
{
    private const ACCEPTED_PREFIXES = ['order.', 'product.created', 'product.updated', 'coupon.created', 'coupon.updated', 'coupon.deleted'];

    public function handleIncomingWebhook(
        int $userId,
        string $rawPayload,
        ?string $signature,
        ?string $topic,
        ?string $deliveryId = null
    ): array {
        [$integration, $user] = $this->resolveActiveIntegrationAndOwner($userId);
        $this->verifySignature($integration, $userId, $rawPayload, $signature);

        return TenantContext::runAs($user->id, fn () => $this->dispatchVerifiedWebhook($userId, $rawPayload, $topic, $deliveryId));
    }

    private function dispatchVerifiedWebhook(int $userId, string $rawPayload, ?string $topic, ?string $deliveryId): array
    {
        if (!$this->isAcceptedTopic($topic)) {
            return ['status' => 200, 'body' => ['message' => "Webhook topic '{$topic}' ignored"]];
        }
        if ($this->isDuplicateDelivery($userId, $deliveryId)) {
            return ['status' => 200, 'body' => ['message' => 'Duplicate WooCommerce webhook ignored']];
        }

        $payload = json_decode($rawPayload, true);
        if (!$payload) {
            throw new WooCommerceConnectionException('Invalid JSON payload', 400);
        }
        if (isset($payload['webhook_id'])) {
            return ['status' => 200, 'body' => ['message' => 'Webhook ping received successfully']];
        }

        ProcessWooCommerceWebhookJob::dispatch($userId, $topic, $payload);

        return ['status' => 202, 'body' => ['success' => true, 'message' => 'Webhook queued for processing']];
    }

    private function isAcceptedTopic(?string $topic): bool
    {
        if (empty($topic)) {
            return true;
        }
        $normalized = strtolower(trim($topic));
        if (str_contains($normalized, 'ping')) {
            return true;
        }
        foreach (self::ACCEPTED_PREFIXES as $prefix) {
            if (str_starts_with($normalized, $prefix)) {
                return true;
            }
        }

        return false;
    }

    private function isDuplicateDelivery(int $userId, ?string $deliveryId): bool
    {
        $clean = trim((string) $deliveryId);
        if ($clean === '') {
            return false;
        }

        return !Cache::add("wc_wh_seen_{$userId}_{$clean}", true, now()->addHours(24));
    }

    /** @return array{0: WooCommerceIntegration, 1: User} */
    protected function resolveActiveIntegrationAndOwner(int $userId): array
    {
        $integration = WooCommerceIntegration::withoutGlobalScopes()
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->first();

        if (!$integration) {
            throw new WooCommerceConnectionException('Integration inactive or not found', 404);
        }

        $user = User::withoutGlobalScopes()->find($userId);
        $gate = $user ? SubscriptionGate::statusFor($user) : null;
        if (!$user || empty($gate['active']) || empty($gate['ecommerce_enabled'])) {
            throw new WooCommerceConnectionException('Store owner not found, subscription inactive, or e-commerce addon disabled', 403);
        }

        return [$integration, $user];
    }

    protected function verifySignature(WooCommerceIntegration $integration, int $userId, string $rawPayload, ?string $signature): void
    {
        if (empty($integration->webhook_secret)) {
            Log::error("WooCommerce webhook rejected: webhook_secret not configured for user #{$userId}");
            throw new WooCommerceConnectionException('Webhook secret not configured', 403);
        }

        if (empty($signature)) {
            Log::warning("Missing WooCommerce webhook signature header for user #{$userId}");
            throw new WooCommerceConnectionException('Unauthorized webhook signature', 401);
        }

        $expected = base64_encode(hash_hmac('sha256', $rawPayload, $integration->webhook_secret, true));
        if (!hash_equals($expected, $signature)) {
            Log::warning("Invalid WooCommerce webhook signature for user #{$userId}");
            throw new WooCommerceConnectionException('Unauthorized webhook signature', 401);
        }
    }
}
