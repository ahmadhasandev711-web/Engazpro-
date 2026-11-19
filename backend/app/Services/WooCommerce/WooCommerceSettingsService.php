<?php

namespace App\Services\WooCommerce;

use App\Enums\EcommercePlatform;
use App\Jobs\ImportWooCommerceProductsPageJob;
use App\Jobs\PushAllWooCommerceStocksJob;
use App\Models\Product;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\EcommerceAccessService;
use Illuminate\Support\Str;

class WooCommerceSettingsService
{
    public function __construct(
        protected WooCommerceApiClient $apiClient,
        protected WooCommerceCustomerSyncService $customerSyncService,
        protected WooCommerceProductImportService $importService,
        protected WooCommerceBulkStockPushService $bulkStockPushService,
        protected EcommerceAccessService $ecommerceAccess
    ) {}

    public function findForAccount(int $accountId, bool $withBranch = false): ?WooCommerceIntegration
    {
        $query = WooCommerceIntegration::where('user_id', $accountId);
        if ($withBranch) {
            $query->with('onlineBranch');
        }

        return $query->first();
    }

    public function saveSettings(int $accountId, array $validated): WooCommerceIntegration
    {
        if ((bool) ($validated['is_active'] ?? true)) {
            $this->ecommerceAccess->assertPlatformAllowed($accountId, EcommercePlatform::WOOCOMMERCE);
        }

        $integration = WooCommerceIntegration::firstOrNew(['user_id' => $accountId]);
        $integration->store_url = rtrim($validated['store_url'], '/');
        $this->applyCredentialsAndFlags($integration, $validated);
        $integration->save();

        if ($integration->is_active && $integration->consumer_key && $integration->consumer_secret) {
            $this->tryRegisterWebhooksSilently($integration);
        }

        WooStockSyncGate::forget($accountId);

        return $integration->load('onlineBranch');
    }

    public function testConnection(WooCommerceIntegration $integration): bool
    {
        $connected = $this->apiClient->testConnection($integration);
        if ($connected && $integration->is_active) {
            $this->tryRegisterWebhooksSilently($integration);
        }

        return $connected;
    }

    public function registerWebhooks(WooCommerceIntegration $integration): bool
    {
        return $this->apiClient->registerWebhooks($integration);
    }

    public function importProducts(User $user, WooCommerceIntegration $integration, bool $importStock): array
    {
        if (config('queue.default') === 'sync') {
            $result = $this->importService->importProducts($user, $integration, $importStock);

            return ['queued' => false, 'result' => $result];
        }

        ImportWooCommerceProductsPageJob::dispatch($user->getAccountId(), $user->id, 1, $importStock);

        return ['queued' => true];
    }

    public function syncCustomers(User $user, WooCommerceIntegration $integration): int
    {
        $wcCustomers = $this->apiClient->getCustomers($integration, 1, 50);
        $synced = 0;

        foreach ($wcCustomers as $wcCust) {
            $this->customerSyncService->syncCustomerFromWooCommerce($user, $wcCust);
            $synced++;
        }

        return $synced;
    }

    public function countLinkedProducts(int $accountId): int
    {
        return Product::where('user_id', $accountId)
            ->whereNotNull('wc_product_id')
            ->count();
    }

    public function pushAllStocks(User $user, int $linkedCount): array
    {
        $accountId = $user->getAccountId();

        if (config('queue.default') === 'sync') {
            $job = new PushAllWooCommerceStocksJob($accountId, $user->id);

            return ['queued' => false, 'result' => $job->handle($this->bulkStockPushService)];
        }

        PushAllWooCommerceStocksJob::dispatch($accountId, $user->id);

        return ['queued' => true, 'total_linked_products' => $linkedCount];
    }

    private function applyCredentialsAndFlags(WooCommerceIntegration $integration, array $validated): void
    {
        if (!empty($validated['consumer_key'])) {
            $integration->consumer_key = trim($validated['consumer_key']);
        }
        if (!empty($validated['consumer_secret'])) {
            $integration->consumer_secret = trim($validated['consumer_secret']);
        }
        if (empty($integration->webhook_secret)) {
            $integration->webhook_secret = Str::random(32);
        }

        if (array_key_exists('online_branch_id', $validated)) {
            $integration->online_branch_id = $validated['online_branch_id'] ? (int) $validated['online_branch_id'] : null;
        }
        $integration->auto_sync_stock = $validated['auto_sync_stock'] ?? $integration->auto_sync_stock ?? true;
        $integration->is_active = $validated['is_active'] ?? true;
    }

    private function tryRegisterWebhooksSilently(WooCommerceIntegration $integration): void
    {
        try {
            $this->apiClient->registerWebhooks($integration);
        } catch (\Throwable) {
            // Non-blocking
        }
    }
}
