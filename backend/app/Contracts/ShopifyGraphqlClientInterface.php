<?php

namespace App\Contracts;

use App\Models\ShopifyIntegration;

interface ShopifyGraphqlClientInterface
{
    /**
     * @param  array<string, mixed>  $variables
     * @return array<string, mixed>
     */
    public function query(ShopifyIntegration $integration, string $query, array $variables = []): array;

    /**
     * @return array{name: string, currencyCode: string, myshopifyDomain: string}|null
     */
    public function testConnection(ShopifyIntegration $integration): ?array;

    /**
     * @return list<array{id: int, gid: string, name: string, is_active: bool, fulfills_online_orders?: bool}>
     */
    public function getLocations(ShopifyIntegration $integration): array;

    /**
     * @return array{products: list<array<string, mixed>>, has_next_page: bool, end_cursor: ?string}
     */
    public function getProductsPage(ShopifyIntegration $integration, ?string $cursor = null, int $first = 25): array;

    /**
     * @return array{variants: list<array<string, mixed>>, has_next_page: bool, end_cursor: ?string}
     */
    public function getProductVariantsPage(ShopifyIntegration $integration, string $productGid, ?string $cursor = null, int $first = 50): array;

    /**
     * @return array<string, mixed>|null
     */
    public function getProductById(ShopifyIntegration $integration, string $productGid): ?array;

    /**
     * @param  list<array{inventoryItemId: string, locationId: string, quantity: int, changeFromQuantity: ?int}>  $quantities
     * @return array<string, mixed>
     */
    public function setInventoryQuantities(
        ShopifyIntegration $integration,
        array $quantities,
        string $idempotencyKey,
        ?string $referenceDocumentUri = null
    ): array;

    /**
     * Activate tracking for an inventory item at a Shopify location.
     *
     * @return array<string, mixed>
     */
    public function activateInventory(ShopifyIntegration $integration, string $inventoryItemGid, string $locationGid): array;

    /**
     * @return array{orders: list<array<string, mixed>>, has_next_page: bool, end_cursor: ?string}
     */
    public function getOrdersPage(ShopifyIntegration $integration, ?string $cursor = null, int $first = 25, ?string $queryFilter = null): array;

    /**
     * @return array<string, mixed>|null
     */
    public function getOrderById(ShopifyIntegration $integration, string $orderGid): ?array;

    /**
     * @return list<array<string, mixed>>
     */
    public function getOrderFulfillmentOrders(ShopifyIntegration $integration, string $orderGid): array;

    /**
     * @param  array<string, mixed>  $fulfillmentInput
     * @return array<string, mixed>
     */
    public function createFulfillment(ShopifyIntegration $integration, array $fulfillmentInput): array;

    /**
     * @return array<string, mixed>
     */
    public function cancelOrder(
        ShopifyIntegration $integration,
        string $orderGid,
        string $reason,
        bool $restock,
        ?string $staffNote = null
    ): array;

    /**
     * @param  list<string>  $topics
     */
    public function registerWebhooks(ShopifyIntegration $integration, string $callbackUrl, array $topics): bool;

    /**
     * @param  list<array{id: string, price: string, compareAtPrice: ?string}>  $variants
     * @return list<array<string, mixed>>
     */
    public function updateVariantPricesBulk(ShopifyIntegration $integration, string $productGid, array $variants): array;

    public function createCodeBasicDiscount(ShopifyIntegration $integration, array $input): string;

    public function updateCodeBasicDiscount(ShopifyIntegration $integration, string $discountGid, array $input): string;

    public function deactivateCodeDiscount(ShopifyIntegration $integration, string $discountGid): void;

    public function deleteCodeDiscount(ShopifyIntegration $integration, string $discountGid): void;

    public function createAutomaticBxgyDiscount(ShopifyIntegration $integration, array $input): string;

    public function updateAutomaticBxgyDiscount(ShopifyIntegration $integration, string $discountGid, array $input): string;

    public function deleteAutomaticDiscount(ShopifyIntegration $integration, string $discountGid): void;

    /**
     * @return array{nodes: list<array<string, mixed>>, has_next_page: bool, end_cursor: ?string}
     */
    public function getCodeDiscountsPage(ShopifyIntegration $integration, ?string $cursor = null, int $first = 50): array;

    /**
     * @return array{nodes: list<array<string, mixed>>, has_next_page: bool, end_cursor: ?string}
     */
    public function getAutomaticDiscountsPage(ShopifyIntegration $integration, ?string $cursor = null, int $first = 50): array;

    /**
     * @return array<string, mixed>|null
     */
    public function getDiscountNodeById(ShopifyIntegration $integration, string $discountGid): ?array;
}
