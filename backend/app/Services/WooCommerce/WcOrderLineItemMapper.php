<?php

namespace App\Services\WooCommerce;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Scopes\StoreScope;
use App\Support\Quantity;
use Illuminate\Support\Collection;

class WcOrderLineItemMapper
{
    /**
     * @param list<array<string, mixed>> $rawLineItems
     * @return array{0: Collection<int, Product>, 1: Collection<int, ProductVariant>}
     */
    public function mapCatalog(int $accountId, array $rawLineItems): array
    {
        $wcProductIds = [];
        $wcVarIds = [];

        foreach ($rawLineItems as $item) {
            if (!empty($item['product_id'])) {
                $wcProductIds[] = (int) $item['product_id'];
            }
            if (!empty($item['variation_id'])) {
                $wcVarIds[] = (int) $item['variation_id'];
            }
        }

        $wcProductIds = array_values(array_unique(array_filter($wcProductIds)));
        $wcVarIds = array_values(array_unique(array_filter($wcVarIds)));

        $products = !empty($wcProductIds)
            ? Product::withoutGlobalScope(StoreScope::class)->where('user_id', $accountId)->whereIn('wc_product_id', $wcProductIds)->get()->keyBy('wc_product_id')
            : collect();

        $variants = !empty($wcVarIds)
            ? ProductVariant::withoutGlobalScope(StoreScope::class)->where('user_id', $accountId)->whereIn('wc_variation_id', $wcVarIds)->get()->keyBy('wc_variation_id')
            : collect();

        return [$products, $variants];
    }

    /**
     * @param list<array<string, mixed>> $rawLineItems
     * @param Collection<int, Product> $productsByWcId
     * @param Collection<int, ProductVariant> $variantsByWcId
     * @return list<array<string, mixed>>
     */
    public function enrich(int $accountId, array $rawLineItems, Collection $productsByWcId, Collection $variantsByWcId): array
    {
        return array_map(function ($item) use ($productsByWcId, $variantsByWcId) {
            if (isset($item['name']) && is_string($item['name'])) {
                $item['name'] = trim(html_entity_decode(strip_tags($item['name']), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            }

            $wcProductId = (int) ($item['product_id'] ?? 0);
            $wcVarId = !empty($item['variation_id']) ? (int) $item['variation_id'] : null;

            $imageUrl = null;
            if ($wcVarId && isset($variantsByWcId[$wcVarId])) {
                $imageUrl = $variantsByWcId[$wcVarId]->image_url;
            } elseif ($wcProductId && isset($productsByWcId[$wcProductId])) {
                $imageUrl = $productsByWcId[$wcProductId]->image_url;
            } elseif (!empty($item['image']['src'])) {
                $imageUrl = (string) $item['image']['src'];
            }

            $item['image_url'] = $imageUrl;
            $item['attributes'] = $this->extractAttributes($item['meta_data'] ?? []);

            return $item;
        }, $rawLineItems);
    }

    /**
     * @param list<array<string, mixed>> $rawLineItems
     * @param Collection<int, Product> $productsByWcId
     * @param Collection<int, ProductVariant> $variantsByWcId
     * @return list<array<string, mixed>>
     */
    public function buildItemRows(int $accountId, int $wcOrderId, array $rawLineItems, Collection $productsByWcId, Collection $variantsByWcId): array
    {
        $rows = [];
        foreach ($rawLineItems as $item) {
            $wcPid = (int) ($item['product_id'] ?? 0);
            $wcVid = !empty($item['variation_id']) ? (int) $item['variation_id'] : null;

            [$pid, $vid] = $this->resolveProductAndVariantIds($wcPid, $wcVid, $productsByWcId, $variantsByWcId);

            $rows[] = [
                'user_id' => $accountId,
                'wc_order_id' => $wcOrderId,
                'product_id' => $pid,
                'product_variant_id' => $vid,
                'wc_product_id' => $wcPid,
                'wc_variation_id' => $wcVid,
                'quantity' => Quantity::of($item['quantity'] ?? 1)->toDecimalString(),
            ];
        }

        return $rows;
    }

    /**
     * @return array{0: ?int, 1: ?int}
     */
    private function resolveProductAndVariantIds(int $wcProductId, ?int $wcVarId, Collection $productsByWcId, Collection $variantsByWcId): array
    {
        $productId = ($wcProductId && isset($productsByWcId[$wcProductId]))
            ? $productsByWcId[$wcProductId]->id
            : null;

        $productVariantId = ($wcVarId && isset($variantsByWcId[$wcVarId]))
            ? $variantsByWcId[$wcVarId]->id
            : null;

        if ($wcVarId && !$productVariantId) {
            $productId = null;
        }

        return [$productId, $productVariantId];
    }

    /**
     * @return list<array{key: string, value: string}>
     */
    private function extractAttributes(mixed $metaData): array
    {
        if (!is_array($metaData)) {
            return [];
        }

        $attributes = [];
        foreach ($metaData as $meta) {
            $key = (string) ($meta['display_key'] ?? $meta['key'] ?? '');
            $value = (string) ($meta['display_value'] ?? $meta['value'] ?? '');

            if (str_starts_with(trim($key), '_')) {
                continue;
            }

            $cleanKey = trim(html_entity_decode(strip_tags($key), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            $cleanVal = trim(html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8'));

            if ($cleanKey !== '' && $cleanVal !== '') {
                $attributes[] = ['key' => $cleanKey, 'value' => $cleanVal];
            }
        }

        return $attributes;
    }
}
