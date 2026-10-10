<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;

class BarcodeService
{
    /**
     * Generate a collision-free barcode for a store.
     */
    public function generateUniqueBarcode(User $user, ?string $prefix = null): string
    {
        $barcodes = $this->generateUniqueBarcodes($user, 1, $prefix);
        return $barcodes[0];
    }

    /**
     * Generate multiple collision-free barcodes at once for matrix variants.
     *
     * @return array<string>
     */
    public function generateUniqueBarcodes(User $user, int $count = 1, ?string $prefix = null): array
    {
        $count = max(1, min($count, 200));
        $accountId = $user->getAccountId();
        $generated = [];
        $attempts = 0;
        $maxAttempts = $count * 30;

        while (count($generated) < $count && $attempts < $maxAttempts) {
            $attempts++;
            
            // Format: if prefix provided: PREFIX + 8 digits, otherwise 12-digit EAN-style: 20 + 10 digits
            if ($prefix) {
                $candidate = strtoupper(trim($prefix)) . str_pad((string) random_int(10000000, 99999999), 8, '0', STR_PAD_LEFT);
            } else {
                $candidate = '20' . str_pad((string) random_int(1000000000, 9999999999), 10, '0', STR_PAD_LEFT);
            }

            if (in_array($candidate, $generated, true)) {
                continue;
            }

            if ($this->validateUniqueBarcode($user, $candidate)) {
                $generated[] = $candidate;
            }
        }

        return $generated;
    }

    /**
     * Strictly validate barcode uniqueness within the merchant's store.
     */
    public function validateUniqueBarcode(
        User $user,
        string $barcode,
        ?int $ignoreVariantId = null,
        ?int $ignoreProductId = null
    ): bool {
        $barcode = trim($barcode);
        if ($barcode === '') {
            return true;
        }

        $accountId = $user->getAccountId();

        // 1. Check existing products in this store
        $productQuery = Product::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->where('barcode', $barcode)
            ->whereNull('deleted_at');

        if ($ignoreProductId !== null) {
            $productQuery->where('id', '!=', $ignoreProductId);
        }

        if ($productQuery->exists()) {
            return false;
        }

        // 2. Check existing product variants in this store
        $variantQuery = ProductVariant::withoutGlobalScopes()
            ->where('user_id', $accountId)
            ->where('barcode', $barcode)
            ->whereNull('deleted_at');

        if ($ignoreVariantId !== null) {
            $variantQuery->where('id', '!=', $ignoreVariantId);
        }

        if ($variantQuery->exists()) {
            return false;
        }

        return true;
    }
}
