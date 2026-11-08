<?php

namespace App\Support;

class PublicIpPolicy
{
    public static function isPublic(string $ip): bool
    {
        if (
            $ip === '127.0.0.1' ||
            str_starts_with($ip, '127.') ||
            str_starts_with($ip, '169.254.') ||
            $ip === '::1' ||
            $ip === '0.0.0.0'
        ) {
            return false;
        }

        return (bool) filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        );
    }
}
