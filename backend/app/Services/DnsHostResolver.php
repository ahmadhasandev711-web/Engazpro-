<?php

namespace App\Services;

use App\Contracts\HostResolver;

class DnsHostResolver implements HostResolver
{
    /**
     * Resolve a hostname to its list of IPv4 addresses using gethostbynamel.
     *
     * @return string[]
     */
    public function resolve(string $host): array
    {
        $ips = @gethostbynamel($host);
        return is_array($ips) ? $ips : [];
    }
}
