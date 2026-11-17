<?php

namespace App\Contracts;

use App\DTOs\ParsedOnlineOrder;
use App\Enums\EcommercePlatform;
use App\Models\OnlineOrder;
use App\Models\Party;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;

interface StorePlatformOrderAdapterInterface
{
    public function platform(): EcommercePlatform;

    public function isSyncActive(int $accountId): bool;

    /**
     * @return list<array<string, mixed>>
     */
    public function fetchRecentPayloads(User $user, int $limit = 30): array;

    public function parsePayload(array $rawPayload): ParsedOnlineOrder;

    /**
     * @return array{snapshot: list<array<string, mixed>>, item_rows: list<array<string, mixed>>}
     */
    public function mapOrderItems(int $accountId, ParsedOnlineOrder $parsed): array;

    /**
     * @return array{product: ?Product, variant: ?ProductVariant}
     */
    public function resolveItemProduct(int $accountId, array $snapshotItem): array;

    public function syncCustomer(User $user, ParsedOnlineOrder $parsed): ?Party;

    public function resolveBranchId(int $accountId, ParsedOnlineOrder $parsed): ?int;

    /**
     * @return array<string, mixed>
     */
    public function invoiceReferencePayload(OnlineOrder $order): array;

    public function dispatchDeliveredSync(OnlineOrder $order): void;

    public function dispatchCancelledSync(OnlineOrder $order): void;

    public function dispatchStockPush(int $accountId, int $productId, ?int $variantId, ?int $branchId): void;
}
