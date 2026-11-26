<?php

namespace App\Services\Shopify;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Exceptions\ShopifyConnectionException;
use App\Models\Product;
use App\Models\Scopes\StoreScope;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyLocationMapping;
use App\Services\OnlineOrders\OnlineOrderStockReservationService;
use App\Support\Quantity;
use App\Support\ShopifyGid;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ShopifyStockPushService
{
    public function __construct(
        protected ShopifyGraphqlClientInterface $graphqlClient,
        protected OnlineOrderStockReservationService $reservationService
    ) {}

    public function activeMappings(ShopifyIntegration $integration, ?int $onlyBranchId = null): Collection
    {
        return ShopifyLocationMapping::withoutGlobalScopes()
            ->where('user_id', $integration->user_id)
            ->where('shopify_integration_id', $integration->id)
            ->where('is_active', true)
            ->where('auto_sync_stock', true)
            ->whereNotNull('branch_id')
            ->whereHas('branch', fn ($q) => $q->withoutGlobalScope(StoreScope::class)->where('is_active', true))
            ->when($onlyBranchId, fn ($q) => $q->where('branch_id', $onlyBranchId))
            ->get();
    }

    public function availableQuantityForBranch(int $accountId, int $productId, ?int $variantId, int $branchId): Quantity
    {
        return $this->reservationService->netAvailableForBranches($accountId, $productId, $variantId, [$branchId]);
    }

    /**
     * @return array{pushed_entries: int, locations_count: int}
     */
    public function pushProduct(ShopifyIntegration $integration, Product $product, ?int $onlyBranchId = null, ?int $onlyVariantId = null): array
    {
        $mappings = $this->activeMappings($integration, $onlyBranchId);
        if ($mappings->isEmpty()) {
            return ['pushed_entries' => 0, 'locations_count' => 0];
        }

        $entries = $this->buildInventoryEntries($integration, $product, $mappings, $onlyVariantId);
        if (empty($entries)) {
            return ['pushed_entries' => 0, 'locations_count' => $mappings->count()];
        }

        $refUri = "gid://easyfy/Product/{$product->id}";
        $pushed = 0;
        foreach (array_chunk($entries, 250) as $chunk) {
            $pushed += $this->pushChunkWithRecovery($integration, $chunk, $refUri);
        }

        return ['pushed_entries' => $pushed, 'locations_count' => $mappings->count()];
    }

    public function pushProductForAccount(int $accountId, Product $product): array
    {
        if ((int) $product->user_id !== $accountId) {
            abort(403, 'غير مصرح لك بدفع مخزون هذا الصنف.');
        }

        $integration = ShopifyIntegration::where('user_id', $accountId)->where('is_active', true)->first();
        if (!$integration) {
            throw new ShopifyConnectionException('ربط متجر Shopify غير نشط أو غير مهيأ بعد.', 422);
        }

        $product->loadMissing('variants');
        $res = $this->pushProduct($integration, $product);
        $message = $res['pushed_entries'] > 0
            ? "تم دفع رصيد '{$product->name}' إلى {$res['locations_count']} موقع على Shopify بنجاح"
            : "لم يتم دفع رصيد للصنف '{$product->name}' لأن تتبع المخزون (Track quantity) غير مفعّل على Shopify أو لم يتم ربط موقع بفرع نشط.";

        return ['pushed_entries' => $res['pushed_entries'], 'locations_count' => $res['locations_count'], 'message' => $message];
    }

    private function pushChunkWithRecovery(ShopifyIntegration $integration, array $chunk, string $refUri): int
    {
        try {
            $this->graphqlClient->setInventoryQuantities($integration, $chunk, (string) Str::uuid(), $refUri);

            return count($chunk);
        } catch (ShopifyConnectionException $e) {
            if ($this->isNotStockedError($e)) {
                return $this->activateAndRetryChunk($integration, $chunk, $refUri);
            }
            if (count($chunk) > 1) {
                return $this->pushEntriesIndividually($integration, $chunk, $refUri);
            }
            $integration->update(['last_error' => $e->getMessage()]);
            throw $e;
        }
    }

    private function activateAndRetryChunk(ShopifyIntegration $integration, array $chunk, string $refUri): int
    {
        foreach ($chunk as $entry) {
            try {
                $this->graphqlClient->activateInventory($integration, $entry['inventoryItemId'], $entry['locationId']);
            } catch (\Throwable) {
                // Already active items or single broken SKUs are isolated in the subsequent retry.
            }
        }

        try {
            $this->graphqlClient->setInventoryQuantities($integration, $chunk, (string) Str::uuid(), $refUri);

            return count($chunk);
        } catch (ShopifyConnectionException $retryError) {
            if (count($chunk) > 1) {
                return $this->pushEntriesIndividually($integration, $chunk, $refUri);
            }
            $integration->update(['last_error' => $retryError->getMessage()]);
            throw $retryError;
        }
    }

    private function pushEntriesIndividually(ShopifyIntegration $integration, array $chunk, string $refUri): int
    {
        $succeeded = 0;
        foreach ($chunk as $entry) {
            try {
                $this->graphqlClient->setInventoryQuantities($integration, [$entry], (string) Str::uuid(), $refUri);
                $succeeded++;
            } catch (\Throwable $e) {
                $integration->update(['last_error' => $e->getMessage()]);
            }
        }

        return $succeeded;
    }

    private function isNotStockedError(ShopifyConnectionException $e): bool
    {
        foreach ($e->userErrors as $err) {
            $code = strtoupper((string) ($err['code'] ?? ''));
            $msg = strtoupper((string) ($err['message'] ?? ''));
            if (str_contains($code, 'NOT_STOCKED') || str_contains($msg, 'NOT STOCKED')) {
                return true;
            }
        }

        return str_contains(strtoupper($e->getMessage()), 'NOT STOCKED');
    }

    private function buildInventoryEntries(ShopifyIntegration $integration, Product $product, Collection $mappings, ?int $onlyVariantId): array
    {
        $targets = $this->resolveInventoryTargets($product, $onlyVariantId);
        $entries = [];

        foreach ($mappings as $mapping) {
            $locGid = ShopifyGid::toGid('Location', $mapping->shopify_location_id);
            foreach ($targets as $target) {
                $qty = $this->availableQuantityForBranch($integration->user_id, $product->id, $target['variant_id'], (int) $mapping->branch_id);
                $entries[] = [
                    'inventoryItemId' => ShopifyGid::toGid('InventoryItem', $target['inventory_item_id']),
                    'locationId' => $locGid,
                    'quantity' => (int) round($qty->toFloat()),
                    'changeFromQuantity' => null,
                ];
            }
        }

        return $entries;
    }

    /**
     * @return list<array{variant_id: ?int, inventory_item_id: int}>
     */
    private function resolveInventoryTargets(Product $product, ?int $onlyVariantId): array
    {
        $product->loadMissing('variants');
        if ($product->isVariable() && $product->variants->isNotEmpty()) {
            return $product->variants
                ->when($onlyVariantId !== null, fn ($c) => $c->where('id', $onlyVariantId))
                ->filter(fn ($v) => !empty($v->shopify_inventory_item_id) && ($v->shopify_tracked ?? true))
                ->map(fn ($v) => ['variant_id' => $v->id, 'inventory_item_id' => (int) $v->shopify_inventory_item_id])
                ->values()->all();
        }

        return !empty($product->shopify_inventory_item_id) && ($product->shopify_tracked ?? true)
            ? [['variant_id' => null, 'inventory_item_id' => (int) $product->shopify_inventory_item_id]]
            : [];
    }
}
