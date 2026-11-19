<?php

namespace App\Observers;

use App\Models\Product;
use App\Services\EcommerceCatalogSyncDispatcher;

class ProductPriceEcommerceSyncObserver
{
    public function updated(Product $product): void
    {
        if (!$product->wasChanged(['regular_price', 'sale_price'])) {
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
