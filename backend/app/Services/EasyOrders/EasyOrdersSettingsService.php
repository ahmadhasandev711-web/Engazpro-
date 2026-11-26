<?php

namespace App\Services\EasyOrders;

use App\Contracts\EasyOrdersApiClientInterface;
use App\Enums\EasyOrdersAuthMode;
use App\Enums\EcommercePlatform;
use App\Exceptions\EasyOrdersConnectionException;
use App\Jobs\ImportEasyOrdersProductsJob;
use App\Jobs\PushAllStockToEasyOrdersJob;
use App\Models\EasyOrdersIntegration;
use App\Models\Product;
use App\Models\User;
use App\Services\EcommerceAccessService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class EasyOrdersSettingsService
{
    public function __construct(
        protected EasyOrdersApiClientInterface $apiClient,
        protected EasyOrdersProductImportService $importService,
        protected EasyOrdersBulkStockPushService $bulkStockPushService,
        protected EcommerceAccessService $ecommerceAccess
    ) {}

    public function findForAccount(int $accountId, bool $withBranch = false): ?EasyOrdersIntegration
    {
        $query = EasyOrdersIntegration::where('user_id', $accountId);
        if ($withBranch) {
            $query->with('defaultBranch:id,name,code');
        }

        return $query->first();
    }

    public function findActiveOrFail(int $accountId): EasyOrdersIntegration
    {
        $integration = $this->findForAccount($accountId);
        if (!$integration || empty($integration->api_key)) {
            throw new EasyOrdersConnectionException('يرجى إدخال مفتاح Api-Key لمتجر EasyOrders أو إتمام الربط السريع أولاً.', 422);
        }

        return $integration;
    }

    public function saveSettings(int $accountId, array $validated): EasyOrdersIntegration
    {
        if ((bool) ($validated['is_active'] ?? true)) {
            $this->ecommerceAccess->assertPlatformAllowed($accountId, EcommercePlatform::EASYORDERS);
        }

        $integration = EasyOrdersIntegration::firstOrNew(['user_id' => $accountId]);
        $this->fillIntegrationFields($integration, $validated);
        $integration->save();
        EasyOrdersStockSyncGate::forget($accountId);

        return $integration->load('defaultBranch:id,name,code');
    }

    public function buildInstallUrl(int $accountId): array
    {
        $this->ecommerceAccess->assertPlatformAllowed($accountId, EcommercePlatform::EASYORDERS);
        $token = Str::random(40);
        Cache::put("easyorders_install_state:{$token}", ['account_id' => $accountId], now()->addMinutes(30));

        $apiBase = rtrim((string) config('app.url'), '/');
        $frontBase = rtrim((string) (config('services.easyorders.frontend_redirect_url') ?: config('app.url')), '/');
        $webhooks = $this->webhookUrls($accountId);

        $query = http_build_query([
            'app_name' => 'Easyfy',
            'app_description' => 'ربط المخزون والفروع والاستبدال الذكي مع متجر EasyOrders',
            'app_icon' => (string) config('services.easyorders.app_icon_url'),
            'permissions' => 'products:read,products:update,orders:read,orders:update,categories:read',
            'callback_url' => "{$apiBase}/api/webhooks/easyorders/install-callback/{$token}",
            'orders_webhook' => $webhooks['orders_webhook'],
            'order_status_webhook' => $webhooks['order_status_webhook'],
            'redirect_url' => str_contains($frontBase, '/easyorders') ? $frontBase : "{$frontBase}/easyorders?connected=1",
        ], '', '&', PHP_QUERY_RFC3986);

        return ['install_url' => rtrim((string) config('services.easyorders.app_install_url'), '?') . '?' . $query];
    }

    public function testConnection(int $accountId): array
    {
        $integration = $this->findActiveOrFail($accountId);
        try {
            $connected = $this->apiClient->testConnection($integration);
            $integration->update(['last_synced_at' => now(), 'last_error' => null]);

            return ['connected' => $connected, 'store_name' => $integration->store_name];
        } catch (\Throwable $e) {
            $integration->update(['last_error' => $e->getMessage()]);

            return ['connected' => false, 'error' => $e->getMessage()];
        }
    }

    public function importProducts(User $user, bool $importStock = false): array
    {
        $integration = $this->findActiveOrFail($user->getAccountId());
        if (config('queue.default') !== 'sync') {
            ImportEasyOrdersProductsJob::dispatch($user->getAccountId(), $importStock);

            return ['queued' => true, 'result' => null];
        }

        return ['queued' => false, 'result' => $this->importService->importProducts($user, $integration, $importStock)];
    }

    public function pushAllStocks(User $user): array
    {
        $integration = $this->findActiveOrFail($user->getAccountId());
        $linkedCount = Product::where('user_id', $integration->user_id)->whereNotNull('easyorders_product_id')->count();

        if (config('queue.default') !== 'sync') {
            PushAllStockToEasyOrdersJob::dispatch($integration->user_id);

            return ['queued' => true, 'linked_count' => $linkedCount, 'result' => null];
        }

        return ['queued' => false, 'linked_count' => $linkedCount, 'result' => $this->bulkStockPushService->pushAllLinked($integration)];
    }

    /**
     * @return array{orders_webhook: string, order_status_webhook: string}
     */
    public function webhookUrls(int $accountId): array
    {
        $base = rtrim((string) config('app.url'), '/');

        return [
            'orders_webhook' => "{$base}/api/webhooks/easyorders/{$accountId}/orders",
            'order_status_webhook' => "{$base}/api/webhooks/easyorders/{$accountId}/order-status",
        ];
    }

    private function fillIntegrationFields(EasyOrdersIntegration $integration, array $validated): void
    {
        $integration->store_name = $validated['store_name'] ?? $integration->store_name;
        $integration->store_id = $validated['store_id'] ?? $integration->store_id;
        $integration->auth_mode = $validated['auth_mode'] ?? ($integration->auth_mode?->value ?? EasyOrdersAuthMode::API_KEY->value);
        if (!empty($validated['api_key'])) {
            $integration->api_key = $validated['api_key'];
        }
        if (array_key_exists('webhook_secret', $validated) && !empty($validated['webhook_secret'])) {
            $integration->webhook_secret = $validated['webhook_secret'];
        } elseif (!$integration->webhook_secret) {
            $integration->webhook_secret = Str::random(32);
        }
        $integration->default_branch_id = $validated['default_branch_id'] ?? $integration->default_branch_id;
        $integration->auto_sync_stock = (bool) ($validated['auto_sync_stock'] ?? $integration->auto_sync_stock ?? true);
        $integration->is_active = (bool) ($validated['is_active'] ?? $integration->is_active ?? true);
    }
}
