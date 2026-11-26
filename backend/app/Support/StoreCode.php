<?php

namespace App\Support;

class StoreCode
{
    public const ADMIN_CODE = 'easyfy';
    public const PATTERN = '/^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/';

    /** @var list<string> */
    private const RESERVED = [
        'easyfy',
        'admin',
        'administrator',
        'api',
        'app',
        'www',
        'auth',
        'login',
        'register',
        'system',
        'root',
        'support',
        'billing',
        'mail',
        'pos',
    ];

    public static function normalize(?string $value): string
    {
        return strtolower(trim((string) $value));
    }

    public static function isAdminCode(?string $value): bool
    {
        return self::normalize($value) === self::ADMIN_CODE;
    }

    public static function isReserved(?string $value): bool
    {
        return in_array(self::normalize($value), self::RESERVED, true);
    }

    public static function isValidFormat(?string $value): bool
    {
        $normalized = self::normalize($value);

        return preg_match(self::PATTERN, $normalized) === 1;
    }
}
