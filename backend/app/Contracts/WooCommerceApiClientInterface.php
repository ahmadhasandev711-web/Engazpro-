<?php

namespace App\Contracts;

use App\Models\WooCommerceIntegration;

interface WooCommerceApiClientInterface
{
    public function testConnection(WooCommerceIntegration $config): bool;

    public function getProducts(WooCommerceIntegration $config, int $page = 1, int $perPage = 50, string $status = 'publish'): array;

    public function getProduct(WooCommerceIntegration $config, int $wcProductId): ?array;

    public function getProductVariations(WooCommerceIntegration $config, int $wcProductId): array;

    public function updateProductStock(WooCommerceIntegration $config, int $wcProductId, float $qty): bool;

    public function updateVariationStock(WooCommerceIntegration $config, int $wcProductId, int $wcVariationId, float $qty): bool;

    public function updateProductPrices(WooCommerceIntegration $config, int $wcProductId, string $regularPrice, string $salePrice): bool;

    public function updateVariationPrices(WooCommerceIntegration $config, int $wcProductId, int $wcVariationId, string $regularPrice, string $salePrice): bool;

    /**
     * @param list<array{id: int, regular_price: string, sale_price: string}> $updates
     */
    public function batchUpdateVariationPrices(WooCommerceIntegration $config, int $wcProductId, array $updates): bool;

    public function getCoupons(WooCommerceIntegration $config, int $page = 1, int $perPage = 50): array;

    public function createCoupon(WooCommerceIntegration $config, array $data): ?array;

    public function updateCoupon(WooCommerceIntegration $config, int $wcCouponId, array $data): ?array;

    public function deleteCoupon(WooCommerceIntegration $config, int $wcCouponId): bool;

    public function getCustomers(WooCommerceIntegration $config, int $page = 1, int $perPage = 50): array;

    public function createCustomer(WooCommerceIntegration $config, array $data): ?array;

    public function updateCustomer(WooCommerceIntegration $config, int $wcCustomerId, array $data): bool;

    public function getOrders(WooCommerceIntegration $config, string $status = 'processing', int $page = 1, int $perPage = 20): array;

    public function updateOrderStatus(WooCommerceIntegration $config, int $wcOrderId, string $status): bool;

    public function getStoreCurrency(WooCommerceIntegration $config): string;

    public function registerWebhooks(WooCommerceIntegration $config): bool;
}
