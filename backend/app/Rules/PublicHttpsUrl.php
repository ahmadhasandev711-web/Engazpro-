<?php

namespace App\Rules;

use App\Contracts\HostResolver;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class PublicHttpsUrl implements ValidationRule
{
    protected HostResolver $hostResolver;

    public function __construct(?HostResolver $hostResolver = null)
    {
        $this->hostResolver = $hostResolver ?? app(HostResolver::class);
    }

    /**
     * Run the validation rule.
     *
     * @param  \Closure(string, ?string=): \Illuminate\Translation\PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (!is_string($value) || empty($value)) {
            $fail('الرابط المدخل غير صالح.');
            return;
        }

        $parsed = parse_url($value);
        if ($parsed === false || empty($parsed['scheme']) || empty($parsed['host'])) {
            $fail('الرابط المدخل غير صالح.');
            return;
        }

        if (strtolower($parsed['scheme']) !== 'https') {
            $fail('يجب أن يبدأ رابط المتجر ببروتوكول آمن https:// حصراً.');
            return;
        }

        $host = strtolower($parsed['host']);

        // Prevent explicit localhost / loopback names
        if (
            $host === 'localhost' ||
            str_ends_with($host, '.localhost') ||
            str_ends_with($host, '.local') ||
            $host === 'ip6-localhost' ||
            $host === 'ip6-loopback'
        ) {
            $fail('غير مسموح بربط عناوين الشبكة المحلية أو الداخلية.');
            return;
        }

        // If host is direct IP address
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            if (!$this->isPublicIp($host)) {
                $fail('غير مسموح بربط عناوين الآي بي الداخلية أو الخاصة.');
                return;
            }
            return;
        }

        // Resolve domain name using HostResolver
        $ips = $this->hostResolver->resolve($host);

        if (empty($ips)) {
            $fail('تعذر التحقق من عنوان المتجر أو أن اسم النطاق غير موجود.');
            return;
        }

        foreach ($ips as $ip) {
            if (!$this->isPublicIp($ip)) {
                $fail('اسم النطاق يشير إلى عناوين آي بي داخلية أو خاصة غير مسموح بها.');
                return;
            }
        }
    }

    protected function isPublicIp(string $ip): bool
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
