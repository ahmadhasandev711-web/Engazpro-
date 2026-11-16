<?php

namespace App\Support;

use App\Exceptions\ShopifyConnectionException;

class ShopifyGid
{
    public static function extractId(string|int|null $gidOrId): ?int
    {
        if ($gidOrId === null || $gidOrId === '') {
            return null;
        }

        if (is_int($gidOrId) || ctype_digit((string) $gidOrId)) {
            $id = (int) $gidOrId;

            return $id > 0 ? $id : null;
        }

        $clean = strtok((string) $gidOrId, '?');
        $lastSlash = strrpos($clean, '/');
        $tail = $lastSlash !== false ? substr($clean, $lastSlash + 1) : $clean;

        return ctype_digit($tail) && (int) $tail > 0 ? (int) $tail : null;
    }

    public static function toGid(string $resource, int|string $id): string
    {
        $numeric = self::extractId($id);
        if (!$numeric) {
            return (string) $id;
        }

        return "gid://shopify/{$resource}/{$numeric}";
    }

    public static function normalizeShopDomain(string $input): string
    {
        $trimmed = strtolower(trim($input));
        $trimmed = preg_replace('#^https?://#i', '', $trimmed) ?? $trimmed;
        $host = explode('/', $trimmed)[0];
        $host = rtrim(explode('?', $host)[0], '.');

        if ($host === '' || !preg_match('/^[a-z0-9][a-z0-9\-]*(\.[a-z0-9\-]+)+$/', $host)) {
            throw new ShopifyConnectionException('نطاق متجر Shopify غير صالح (مثال: my-store.myshopify.com).', 422);
        }

        return $host;
    }
}
