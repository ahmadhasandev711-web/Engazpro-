<?php

namespace App\Contracts;

use App\Models\EasyOrdersIntegration;

interface EasyOrdersApiClientInterface
{
    public function testConnection(EasyOrdersIntegration $integration): bool;

    /**
     * @return array{products: list<array<string, mixed>>, has_next_page: bool, page_count: int}
     */
    public function getProductsPage(EasyOrdersIntegration $integration, int $page = 1, int $limit = 20): array;

    /**
     * @return array{orders: list<array<string, mixed>>, has_next_page: bool, page_count: int}
     */
    public function getOrdersPage(EasyOrdersIntegration $integration, int $page = 1, int $limit = 20, ?string $status = null): array;

    /**
     * @return array<string, mixed>
     */
    public function getOrderById(EasyOrdersIntegration $integration, string $orderId): array;

    /**
     * @return array<string, mixed>
     */
    public function updateOrderStatus(EasyOrdersIntegration $integration, string $orderId, string $status): array;

    /**
     * @return array<string, mixed>
     */
    public function updateProductStockBySku(EasyOrdersIntegration $integration, string $sku, int $quantity): array;

    /**
     * @return array<string, mixed>
     */
    public function updateVariantStock(EasyOrdersIntegration $integration, string $productCode, string $variantCode, int $quantity): array;
}
