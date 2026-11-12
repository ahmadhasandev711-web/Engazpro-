<?php

namespace App\Rules;

use App\Contracts\HostResolver;
use App\Support\DevNetworkPolicy;
use App\Support\PublicIpPolicy;
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

        $allowsInsecure = DevNetworkPolicy::allowsInsecure();

        if (!$this->validateScheme((string) $parsed['scheme'], $allowsInsecure, $fail)) {
            return;
        }

        $host = strtolower((string) $parsed['host']);
        if (!$this->validateHostName($host, $allowsInsecure, $fail)) {
            return;
        }

        $this->validateHostResolution($host, $allowsInsecure, $fail);
    }

    private function validateScheme(string $scheme, bool $allowsInsecure, Closure $fail): bool
    {
        $normalizedScheme = strtolower($scheme);
        if ($normalizedScheme !== 'https') {
            if (!($allowsInsecure && $normalizedScheme === 'http')) {
                $fail('يجب أن يبدأ رابط المتجر ببروتوكول آمن https:// حصراً.');
                return false;
            }
        }

        return true;
    }

    private function validateHostName(string $host, bool $allowsInsecure, Closure $fail): bool
    {
        if (!$allowsInsecure) {
            if (
                $host === 'localhost' ||
                str_ends_with($host, '.localhost') ||
                str_ends_with($host, '.local') ||
                $host === 'ip6-localhost' ||
                $host === 'ip6-loopback'
            ) {
                $fail('غير مسموح بربط عناوين الشبكة المحلية أو الداخلية.');
                return false;
            }
        }

        if (filter_var($host, FILTER_VALIDATE_IP)) {
            if (!$allowsInsecure && !PublicIpPolicy::isPublic($host)) {
                $fail('غير مسموح بربط عناوين الآي بي الداخلية أو الخاصة.');
                return false;
            }
        }

        return true;
    }

    private function validateHostResolution(string $host, bool $allowsInsecure, Closure $fail): void
    {
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return;
        }

        $ips = $this->hostResolver->resolve($host);
        if (empty($ips)) {
            $fail('تعذر التحقق من عنوان المتجر أو أن اسم النطاق غير موجود.');
            return;
        }

        if (!$allowsInsecure) {
            foreach ($ips as $ip) {
                if (!PublicIpPolicy::isPublic($ip)) {
                    $fail('اسم النطاق يشير إلى عناوين آي بي داخلية أو خاصة غير مسموح بها.');
                    return;
                }
            }
        }
    }

    protected function isPublicIp(string $ip): bool
    {
        return PublicIpPolicy::isPublic($ip);
    }
}
