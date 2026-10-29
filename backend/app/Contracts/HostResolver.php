<?php

namespace App\Contracts;

interface HostResolver
{
    /**
     * Resolve a hostname to its list of IPv4 addresses.
     *
     * @return string[]
     */
    public function resolve(string $host): array;
}
