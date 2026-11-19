<?php

namespace App\Observers;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Services\EcommerceCatalogSyncDispatcher;

class ProductVariantPriceEcommerceSyncObserver
{
    public function updated(ProductVariant $variant): void
    {
        if (!$variant->wasChanged(['regular_price', 'sale_price'])) {
            return;
        }

        $product = Product::withoutGlobalScopes()
            ->whereKey($variant->product_id)
            ->first(['id', 'user_id', 'wc_product_id', 'shopify_product_id']);

        if (!$product) {
            return;
        }

        app(EcommerceCatalogSyncDispatcher::class)->dispatchProductPricePush(
            (int) $product->user_id,
            (int) $product->id,
            $product->wc_product_id,
            $product->shopify_product_id
        );
    }
}
