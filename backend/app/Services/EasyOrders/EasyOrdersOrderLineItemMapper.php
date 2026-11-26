<?php

namespace App\Services\EasyOrders;

use App\Models\Product;
use App\Models\ProductVariant;
use Illuminate\Support\Collection;

class EasyOrdersOrderLineItemMapper
{
    public function enrich(int $accountId, array $lineItems): array
    {
        [$byProductId, $bySku, $byVariantId, $byVariantCode] = $this->loadCatalogMaps($accountId, $lineItems);

        return collect($lineItems)->map(fn (array $item) => $this->enrichSingleItem($item, $byProductId, $bySku, $byVariantId, $byVariantCode))
            ->values()
            ->all();
    }

    /**
     * @return array{0: Collection, 1: Collection, 2: Collection, 3: Collection}
     */
    private function loadCatalogMaps(int $accountId, array $lineItems): array
    {
        $prodIds = collect($lineItems)->pluck('easyorders_product_id')->filter()->unique()->values();
        $varIds = collect($lineItems)->pluck('easyorders_variant_id')->filter()->unique()->values();
        $skus = collect($lineItems)->pluck('sku')->filter()->unique()->values();
        $vCodes = collect($lineItems)->pluck('variant_taager_code')->filter()->unique()->values();

        return [
            $prodIds->isNotEmpty() ? Product::where('user_id', $accountId)->whereIn('easyorders_product_id', $prodIds)->get()->keyBy('easyorders_product_id') : collect(),
            $skus->isNotEmpty() ? Product::where('user_id', $accountId)->where(fn ($q) => $q->whereIn('easyorders_sku', $skus)->orWhereIn('code', $skus)->orWhereIn('barcode', $skus))->get() : collect(),
            $varIds->isNotEmpty() ? ProductVariant::where('user_id', $accountId)->whereIn('easyorders_variant_id', $varIds)->get()->keyBy('easyorders_variant_id') : collect(),
            $vCodes->isNotEmpty() ? ProductVariant::where('user_id', $accountId)->whereIn('easyorders_taager_code', $vCodes)->get()->keyBy('easyorders_taager_code') : collect(),
        ];
    }

    private function enrichSingleItem(array $item, Collection $byProductId, Collection $bySku, Collection $byVariantId, Collection $byVariantCode): array
    {
        $variant = $this->matchVariant($item, $byVariantId, $byVariantCode);
        $product = $this->matchProduct($item, $variant, $byProductId, $bySku);

        return [
            'product_id' => $product?->id,
            'product_variant_id' => $variant?->id,
            'easyorders_product_id' => $item['easyorders_product_id'],
            'easyorders_variant_id' => $item['easyorders_variant_id'],
            'name' => $product?->name ?? $item['title'],
            'variant_name' => $variant?->name ?? $item['variant_title'],
            'sku' => $item['sku'],
            'quantity' => $item['quantity'],
            'price' => $item['unit_price'],
            'image_url' => $variant?->image_url ?? $product?->image_url ?? $item['image_url'],
        ];
    }

    private function matchVariant(array $item, Collection $byVariantId, Collection $byVariantCode): ?ProductVariant
    {
        if (!empty($item['easyorders_variant_id']) && ($v = $byVariantId->get($item['easyorders_variant_id']))) {
            return $v;
        }
        if (!empty($item['variant_taager_code']) && ($v = $byVariantCode->get($item['variant_taager_code']))) {
            return $v;
        }

        return null;
    }

    private function matchProduct(array $item, ?ProductVariant $variant, Collection $byProductId, Collection $bySku): ?Product
    {
        if (!empty($item['easyorders_product_id']) && ($p = $byProductId->get($item['easyorders_product_id']))) {
            return $p;
        }
        if ($variant) {
            return $variant->product;
        }
        if (!empty($item['sku'])) {
            return $bySku->first(fn ($p) => $p->easyorders_sku === $item['sku'] || $p->code === $item['sku'] || $p->barcode === $item['sku']);
        }

        return null;
    }
}
