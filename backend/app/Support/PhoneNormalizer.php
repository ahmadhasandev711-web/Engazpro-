<?php

namespace App\Support;

class PhoneNormalizer
{
    private const EASTERN = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩', '۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    private const WESTERN = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

    public static function normalize(string $phone): string
    {
        $converted = str_replace(self::EASTERN, self::WESTERN, trim($phone));

        return str_replace(' ', '', $converted);
    }

    public static function canonical(string $phone): string
    {
        $clean = self::normalize($phone);
        if (str_starts_with($clean, '+201') && strlen($clean) === 13) {
            return '0' . substr($clean, 3);
        }
        if (str_starts_with($clean, '201') && strlen($clean) === 12) {
            return '0' . substr($clean, 2);
        }

        return $clean;
    }

    /** @return list<string> */
    public static function variants(string $identifier): array
    {
        $clean = self::normalize($identifier);
        $list = [$clean];
        if (str_starts_with($clean, '01') && strlen($clean) === 11) {
            array_push($list, '2' . $clean, '+2' . $clean);
        } elseif (str_starts_with($clean, '201') && strlen($clean) === 12) {
            array_push($list, '0' . substr($clean, 2), '+' . $clean);
        } elseif (str_starts_with($clean, '+201') && strlen($clean) === 13) {
            array_push($list, '0' . substr($clean, 3), substr($clean, 1));
        }

        return array_values(array_unique($list));
    }
}
