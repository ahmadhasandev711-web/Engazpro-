<?php

namespace App\Contracts;

use App\Models\ShopifyIntegration;

interface ShopifyGraphqlClientInterface
{
    /**
     * Execute an arbitrary Shopify Admin GraphQL query or mutation.
     *
     * @param  array<string, mixed>  $variables
     * @return array<string, mixed>
     */
    public function query(ShopifyIntegration $integration, string $query, array $variables = []): array;

    /**
     * Verify connectivity and return basic shop metadata or null on failure.
     *
     * @return array{name: string, currencyCode: string, myshopifyDomain: string}|null
     */
    public function testConnection(ShopifyIntegration $integration): ?array;

    /**
     * Fetch active and legacy Shopify inventory locations.
     *
     * @return list<array{id: int, gid: string, name: string, is_active: bool}>
     */
    public function getLocations(ShopifyIntegration $integration): array;

    /**
     * Fetch a cursor-paginated page of Shopify products and variants.
     *
     * @return array{products: list<array<string, mixed>>, has_next_page: bool, end_cursor: ?string}
     */
    public function getProductsPage(ShopifyIntegration $integration, ?string $cursor = null, int $first = 50): array;

    /**
     * Push absolute available stock quantities via 2026-04 inventorySetQuantities mutation.
     *
     * @param  list<array{inventoryItemId: string, locationId: string, quantity: int, changeFromQuantity: ?int}>  $quantities
     * @return array<string, mixed>
     */
    public function setInventoryQuantities(ShopifyIntegration $integration, array $quantities, string $idempotencyKey): array;

    /**
     * Fetch a cursor-paginated page of Shopify orders.
     *
     * @return array{orders: list<array<string, mixed>>, has_next_page: bool, end_cursor: ?string}
     */
    public function getOrdersPage(ShopifyIntegration $integration, ?string $cursor = null, int $first = 25, ?string $queryFilter = null): array;

    /**
     * Fetch fulfillment orders for an existing Shopify order GID.
     *
     * @return list<array<string, mixed>>
     */
    public function getOrderFulfillmentOrders(ShopifyIntegration $integration, string $orderGid): array;

    /**
     * Create a Shopify fulfillment with optional tracking details.
     *
     * @param  array<string, mixed>  $fulfillmentInput
     * @return array<string, mixed>
     */
    public function createFulfillment(ShopifyIntegration $integration, array $fulfillmentInput): array;

    /**
     * Register webhook subscriptions via GraphQL webhookSubscriptionCreate.
     *
     * @param  list<string>  $topics
     */
    public function registerWebhooks(ShopifyIntegration $integration, string $callbackUrl, array $topics): bool;
}
