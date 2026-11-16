<?php

namespace App\Services\Shopify;

use App\Models\Product;
use App\Models\ProductVariant;

class ShopifyOrderLineItemMapper
{
    /**
     * @return array{0: \Illuminate\Support\Collection, 1: \Illuminate\Support\Collection, 2: \Illuminate\Support\Collection}
     */
    public function mapCatalog(int $accountId, array $lineItems): array
    {
        $productIds = collect($lineItems)->pluck('shopify_product_id')->filter()->unique()->values();
        $variantIds = collect($lineItems)->pluck('shopify_variant_id')->filter()->unique()->values();
        $skus = collect($lineItems)->pluck('sku')->filter()->unique()->values();

        $productsByShopify = $productIds->isNotEmpty()
            ? Product::where('user_id', $accountId)->whereIn('shopify_product_id', $productIds)->get()->keyBy('shopify_product_id')
            : collect();
        $productsBySku = $skus->isNotEmpty()
            ? Product::where('user_id', $accountId)->where(fn ($q) => $q->whereIn('barcode', $skus)->orWhereIn('code', $skus))->get()
            : collect();
        $variants = $variantIds->isNotEmpty()
            ? ProductVariant::where('user_id', $accountId)->whereIn('shopify_variant_id', $variantIds)->get()->keyBy('shopify_variant_id')
            : collect();

        return [$productsByShopify, $productsBySku, $variants];
    }

    public function enrich(int $accountId, array $lineItems): array
    {
        [$byShopify, $bySku, $variants] = $this->mapCatalog($accountId, $lineItems);

        return collect($lineItems)->map(function (array $item) use ($byShopify, $bySku, $variants) {
            $variant = !empty($item['shopify_variant_id']) ? $variants->get($item['shopify_variant_id']) : null;
            $product = !empty($item['shopify_product_id']) ? $byShopify->get($item['shopify_product_id']) : null;
            if (!$product && !empty($item['sku'])) {
                $product = $bySku->first(fn ($p) => $p->barcode === $item['sku'] || $p->code === $item['sku']);
            }

            return [
                'product_id' => $product?->id,
                'product_variant_id' => $variant?->id,
                'shopify_product_id' => $item['shopify_product_id'],
                'shopify_variant_id' => $item['shopify_variant_id'],
                'name' => $product?->name ?? $item['title'],
                'variant_name' => $variant?->name ?? $item['variant_title'],
                'sku' => $item['sku'],
                'quantity' => $item['quantity'],
                'price' => $item['unit_price'],
                'compare_at_price' => $item['compare_at_price'],
                'image_url' => $variant?->image_url ?? $product?->image_url ?? $item['image_url'],
            ];
        })->values()->all();
    }
}
