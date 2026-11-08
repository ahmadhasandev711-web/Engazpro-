<?php

namespace Tests\Unit\Support;

use App\Support\PublicIpPolicy;
use PHPUnit\Framework\TestCase;

class PublicIpPolicyTest extends TestCase
{
    public function test_rejects_private_and_reserved_ips(): void
    {
        $nonPublicIps = [
            '10.0.0.1',
            '10.255.255.255',
            '172.16.0.1',
            '172.31.255.255',
            '192.168.1.1',
            '192.168.0.100',
            '127.0.0.1',
            '127.1.2.3',
            '169.254.1.1',
            '169.254.169.254',
            '::1',
            '0.0.0.0',
            'fc00::1',
            'fd12:3456:789a:1::1',
        ];

        foreach ($nonPublicIps as $ip) {
            $this->assertFalse(
                PublicIpPolicy::isPublic($ip),
                "IP {$ip} was expected to be rejected as non-public."
            );
        }
    }

    public function test_accepts_valid_public_ip(): void
    {
        $this->assertTrue(PublicIpPolicy::isPublic('93.184.216.34'));
    }
}
