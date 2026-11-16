<?php

namespace App\Services\Shopify;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Exceptions\ShopifyConnectionException;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyLocationMapping;
use App\Support\Quantity;
use App\Support\ShopifyGid;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ShopifyStockPushService
{
    public function __construct(
        protected ShopifyGraphqlClientInterface $graphqlClient,
        protected ShopifyStockReservationService $reservationService
    ) {}

    public function activeMappings(ShopifyIntegration $integration, ?int $onlyBranchId = null): Collection
    {
        return ShopifyLocationMapping::withoutGlobalScopes()
            ->where('user_id', $integration->user_id)
            ->where('shopify_integration_id', $integration->id)
            ->where('is_active', true)
            ->where('auto_sync_stock', true)
            ->whereNotNull('branch_id')
            ->whereHas('branch', fn ($q) => $q->withoutGlobalScopes()->where('is_active', true))
            ->when($onlyBranchId, fn ($q) => $q->where('branch_id', $onlyBranchId))
            ->get();
    }

    public function availableQuantityForBranch(int $accountId, int $productId, ?int $variantId, int $branchId): Quantity
    {
        $raw = BranchStock::withoutGlobalScopes()
            ->where('branch_id', $branchId)
            ->where('product_id', $productId)
            ->when($variantId !== null, fn ($q) => $q->where('product_variant_id', $variantId), fn ($q) => $q->whereNull('product_variant_id'))
            ->sum('quantity') ?? 0;

        $reserved = $this->reservationService->reservedQuantity($accountId, $productId, $variantId, [$branchId]);

        return Quantity::of($raw)->subtract($reserved)->maxZero();
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
        foreach (array_chunk($entries, 250) as $chunk) {
            $this->graphqlClient->setInventoryQuantities($integration, $chunk, (string) Str::uuid());
        }

        return ['pushed_entries' => count($entries), 'locations_count' => $mappings->count()];
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

        return ['pushed_entries' => $res['pushed_entries'], 'locations_count' => $res['locations_count'], 'message' => "تم دفع رصيد '{$product->name}' إلى {$res['locations_count']} موقع على Shopify بنجاح"];
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
                ->filter(fn ($v) => !empty($v->shopify_inventory_item_id))
                ->map(fn ($v) => ['variant_id' => $v->id, 'inventory_item_id' => (int) $v->shopify_inventory_item_id])
                ->values()->all();
        }

        return !empty($product->shopify_inventory_item_id)
            ? [['variant_id' => null, 'inventory_item_id' => (int) $product->shopify_inventory_item_id]]
            : [];
    }
}
