<?php

namespace App\Services\Shopify;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\EcommercePlatform;
use App\Enums\ShopifyAuthMode;
use App\Exceptions\ShopifyConnectionException;
use App\Jobs\ImportShopifyProductsPageJob;
use App\Jobs\PushAllShopifyStocksJob;
use App\Models\Branch;
use App\Models\Product;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyLocationMapping;
use App\Models\User;
use App\Services\EcommerceAccessService;
use App\Support\ShopifyGid;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ShopifySettingsService
{
    public const DEFAULT_WEBHOOK_TOPICS = [
        'ORDERS_CREATE',
        'ORDERS_UPDATED',
        'ORDERS_CANCELLED',
        'PRODUCTS_CREATE',
        'PRODUCTS_UPDATE',
    ];

    public function __construct(
        protected ShopifyGraphqlClientInterface $graphqlClient,
        protected ShopifyAuthService $authService,
        protected ShopifyProductImportService $importService,
        protected ShopifyBulkStockPushService $bulkStockPushService,
        protected EcommerceAccessService $ecommerceAccess
    ) {}

    public function findForAccount(int $accountId, bool $withRelations = false): ?ShopifyIntegration
    {
        $query = ShopifyIntegration::where('user_id', $accountId);
        if ($withRelations) {
            $query->with(['defaultBranch', 'locationMappings.branch']);
        }

        return $query->first();
    }

    public function findActiveOrFail(int $accountId): ShopifyIntegration
    {
        $integration = $this->findForAccount($accountId);
        if (!$integration) {
            throw new ShopifyConnectionException('يرجى إعداد ربط متجر Shopify أولاً وحفظ الإعدادات.', 422);
        }

        return $integration;
    }

    public function saveSettings(int $accountId, array $validated): ShopifyIntegration
    {
        if ((bool) ($validated['is_active'] ?? true)) {
            $this->ecommerceAccess->assertPlatformAllowed($accountId, EcommercePlatform::SHOPIFY);
        }

        $integration = ShopifyIntegration::firstOrNew(['user_id' => $accountId]);
        $integration->shop_domain = ShopifyGid::normalizeShopDomain((string) $validated['shop_domain']);
        $integration->auth_mode = $validated['auth_mode'] ?? ($integration->auth_mode?->value ?? ShopifyAuthMode::ACCESS_TOKEN->value);
        $this->applyCredentialsAndFlags($integration, $validated);
        $integration->save();

        if ($integration->is_active) {
            $this->tryInitialSyncSilently($integration);
        }
        ShopifyStockSyncGate::forget($accountId);

        return $integration->load(['defaultBranch', 'locationMappings.branch']);
    }

    public function testConnection(int $accountId): array
    {
        $integration = $this->findActiveOrFail($accountId);
        $shop = $this->graphqlClient->testConnection($integration);
        $locationsCount = 0;

        if ($shop) {
            $integration->update(['last_error' => null]);
            $locationsCount = $this->syncLocations($integration)->count();
        }

        return ['connected' => $shop !== null, 'shop' => $shop, 'locations_count' => $locationsCount];
    }

    public function syncLocations(ShopifyIntegration $integration): EloquentCollection
    {
        $remoteLocations = $this->graphqlClient->getLocations($integration);

        DB::transaction(function () use ($integration, $remoteLocations) {
            foreach ($remoteLocations as $loc) {
                $existing = ShopifyLocationMapping::withoutGlobalScopes()
                    ->where('user_id', $integration->user_id)
                    ->where('shopify_location_id', $loc['id'])
                    ->first();

                if ($existing) {
                    $existing->update(['shopify_location_name' => $loc['name'], 'is_active' => $loc['is_active']]);
                } else {
                    ShopifyLocationMapping::create([
                        'user_id' => $integration->user_id,
                        'shopify_integration_id' => $integration->id,
                        'shopify_location_id' => $loc['id'],
                        'shopify_location_name' => $loc['name'],
                        'branch_id' => $integration->default_branch_id,
                        'auto_sync_stock' => true,
                        'is_active' => $loc['is_active'],
                    ]);
                }
            }
        });

        return $integration->locationMappings()->with('branch')->get();
    }

    public function saveLocationMappings(int $accountId, array $mappings): EloquentCollection
    {
        $integration = $this->findActiveOrFail($accountId);
        $validBranches = Branch::where('user_id', $accountId)->pluck('id')->all();

        DB::transaction(function () use ($accountId, $integration, $mappings, $validBranches) {
            foreach ($mappings as $row) {
                $branchId = !empty($row['branch_id']) ? (int) $row['branch_id'] : null;
                if ($branchId !== null && !in_array($branchId, $validBranches, true)) {
                    continue;
                }
                ShopifyLocationMapping::where('user_id', $accountId)
                    ->where('shopify_integration_id', $integration->id)
                    ->whereKey((int) $row['id'])
                    ->update([
                        'branch_id' => $branchId,
                        'auto_sync_stock' => (bool) ($row['auto_sync_stock'] ?? true),
                    ]);
            }
        });
        ShopifyStockSyncGate::forget($accountId);

        return $integration->locationMappings()->with('branch')->get();
    }

    public function syncPostOAuthSetup(ShopifyIntegration $integration): void
    {
        $this->tryInitialSyncSilently($integration);
    }

    public function registerWebhooks(int $accountId): bool
    {
        $integration = $this->findActiveOrFail($accountId);
        $callbackUrl = url("/api/webhooks/shopify/{$integration->user_id}");

        return $this->graphqlClient->registerWebhooks($integration, $callbackUrl, self::DEFAULT_WEBHOOK_TOPICS);
    }

    public function countLinkedProducts(int $accountId): int
    {
        return Product::where('user_id', $accountId)->whereNotNull('shopify_product_id')->count();
    }

    public function importProducts(User $user, bool $importStock = false): array
    {
        $integration = $this->findActiveOrFail($user->getAccountId());
        if (!$integration->is_active) {
            throw new ShopifyConnectionException('ربط متجر Shopify غير نشط حالياً، يرجى تفعيله أولاً.', 422);
        }

        if (config('queue.default') === 'sync') {
            return ['queued' => false, 'result' => $this->importService->importProducts($user, $integration, $importStock)];
        }

        ImportShopifyProductsPageJob::dispatch($user->getAccountId(), $user->id, null, $importStock);

        return ['queued' => true];
    }

    public function pushAllStocks(User $user): array
    {
        $integration = $this->findActiveOrFail($user->getAccountId());
        if (!$integration->is_active) {
            throw new ShopifyConnectionException('ربط متجر Shopify غير نشط حالياً.', 422);
        }

        if (config('queue.default') === 'sync') {
            return ['queued' => false, 'result' => $this->bulkStockPushService->pushAll($user, $integration)];
        }

        PushAllShopifyStocksJob::dispatch($user->getAccountId(), $user->id);

        return ['queued' => true, 'linked_count' => $this->countLinkedProducts($user->getAccountId())];
    }

    private function applyCredentialsAndFlags(ShopifyIntegration $integration, array $validated): void
    {
        if (!empty($validated['access_token']) && !str_contains((string) $validated['access_token'], '...')) {
            $integration->access_token = (string) $validated['access_token'];
        }
        if (array_key_exists('client_id', $validated)) {
            $integration->client_id = $validated['client_id'];
        }
        if (!empty($validated['client_secret']) && !str_contains((string) $validated['client_secret'], '...')) {
            $integration->client_secret = (string) $validated['client_secret'];
        }
        if (!empty($validated['webhook_secret'])) {
            $integration->webhook_secret = (string) $validated['webhook_secret'];
        } elseif (empty($integration->webhook_secret)) {
            $integration->webhook_secret = Str::random(32);
        }
        $integration->default_branch_id = $validated['default_branch_id'] ?? $integration->default_branch_id;
        $integration->auto_sync_stock = (bool) ($validated['auto_sync_stock'] ?? true);
        $integration->is_active = (bool) ($validated['is_active'] ?? true);
    }

    private function tryInitialSyncSilently(ShopifyIntegration $integration): void
    {
        try {
            $this->syncLocations($integration);
            $callbackUrl = url("/api/webhooks/shopify/{$integration->user_id}");
            $this->graphqlClient->registerWebhooks($integration, $callbackUrl, self::DEFAULT_WEBHOOK_TOPICS);
        } catch (\Throwable $e) {
            Log::warning("Shopify initial setup sync failed for store #{$integration->user_id}: " . $e->getMessage());
        }
    }
}
