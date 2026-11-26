<?php

namespace App\Services\EasyOrders;

use App\Enums\EasyOrdersAuthMode;
use App\Enums\EcommercePlatform;
use App\Exceptions\EasyOrdersConnectionException;
use App\Jobs\ProcessEasyOrdersWebhookJob;
use App\Models\EasyOrdersIntegration;
use App\Services\EcommerceAccessService;
use App\Services\SubscriptionGate;
use App\Support\TenantContext;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EasyOrdersWebhookService
{
    public function handleOrderWebhook(int $userId, array $payload, ?string $secretHeader): array
    {
        return $this->dispatchWebhook($userId, 'order-created', $payload, $secretHeader);
    }

    public function handleOrderStatusWebhook(int $userId, array $payload, ?string $secretHeader): array
    {
        return $this->dispatchWebhook($userId, 'order-status-update', $payload, $secretHeader);
    }

    public function handleInstallCallback(string $token, array $payload): array
    {
        $state = Cache::pull("easyorders_install_state:{$token}");
        $accountId = is_array($state) ? (int) ($state['account_id'] ?? 0) : 0;
        if ($accountId <= 0) {
            throw new EasyOrdersConnectionException('رابط التثبيت منتهي الصلاحية أو غير صالح.', 401);
        }

        $apiKey = trim((string) ($payload['api_key'] ?? ($payload['apiKey'] ?? '')));
        if ($apiKey === '') {
            throw new EasyOrdersConnectionException('مفتاح Api-Key غير موجود في استجابة EasyOrders.', 422);
        }

        $integration = DB::transaction(fn () => $this->activateAuthorizedStore($accountId, $apiKey, $payload));
        EcommerceAccessService::clearPlatformCache($accountId);
        EasyOrdersStockSyncGate::forget($accountId);

        return ['success' => true, 'store_id' => $integration->store_id, 'store_name' => $integration->store_name];
    }

    private function dispatchWebhook(int $userId, string $topic, array $payload, ?string $secretHeader): array
    {
        $integration = $this->authenticateWebhook($userId, $secretHeader);
        $dedupeId = (string) ($payload['id'] ?? ($payload['order_id'] ?? ''));

        if ($dedupeId !== '' && !Cache::add("eo_wh:{$integration->user_id}:{$topic}:{$dedupeId}:" . md5((string) json_encode($payload)), 1, 60)) {
            return ['status' => 200, 'body' => ['message' => 'Duplicate EasyOrders webhook ignored']];
        }

        TenantContext::runAs($integration->user_id, fn () => ProcessEasyOrdersWebhookJob::dispatch($integration->user_id, $topic, $payload));

        return ['status' => 202, 'body' => ['success' => true, 'message' => 'EasyOrders webhook queued']];
    }

    private function authenticateWebhook(int $userId, ?string $secretHeader): EasyOrdersIntegration
    {
        $integration = EasyOrdersIntegration::withoutGlobalScopes()->where('user_id', $userId)->where('is_active', true)->first();
        if (!$integration) {
            throw new EasyOrdersConnectionException('EasyOrders integration inactive or not found', 404);
        }

        $expected = trim((string) $integration->webhook_secret);
        if ($expected === '' || !is_string($secretHeader) || !hash_equals($expected, trim($secretHeader))) {
            throw new EasyOrdersConnectionException('Unauthorized EasyOrders webhook secret', 401);
        }

        $gate = SubscriptionGate::statusFor($integration->user);
        if (!$gate['active'] || empty($gate['ecommerce_enabled'])) {
            throw new EasyOrdersConnectionException('Subscription inactive for EasyOrders webhook', 403);
        }

        return $integration;
    }

    private function activateAuthorizedStore(int $accountId, string $apiKey, array $payload): EasyOrdersIntegration
    {
        app(EcommerceAccessService::class)->assertPlatformAllowed($accountId, EcommercePlatform::EASYORDERS);
        $integration = EasyOrdersIntegration::withoutGlobalScopes()->firstOrNew(['user_id' => $accountId]);
        $integration->fill([
            'store_id' => !empty($payload['store_id']) ? (string) $payload['store_id'] : $integration->store_id,
            'store_name' => !empty($payload['store_name']) ? (string) $payload['store_name'] : $integration->store_name,
            'auth_mode' => EasyOrdersAuthMode::AUTHORIZED_APP->value,
            'api_key' => $apiKey,
            'webhook_secret' => !empty($payload['secret']) ? (string) $payload['secret'] : ($integration->webhook_secret ?: Str::random(32)),
            'is_active' => true,
            'auto_sync_stock' => $integration->exists ? $integration->auto_sync_stock : true,
            'webhook_registered_at' => now(),
            'last_error' => null,
        ]);
        $integration->save();

        return $integration;
    }
}
