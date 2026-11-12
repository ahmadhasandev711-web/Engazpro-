<?php

namespace Tests\Unit\Rules;

use App\Contracts\HostResolver;
use App\Rules\PublicHttpsUrl;
use Tests\TestCase;

class PublicHttpsUrlDevNetworkTest extends TestCase
{
    private HostResolver $fakeResolver;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fakeResolver = new class implements HostResolver {
            public function resolve(string $host): array
            {
                if ($host === 'anoofy-wp.test') {
                    return ['172.25.0.2'];
                }
                return [];
            }
        };
    }

    public function test_accepts_http_and_internal_ip_in_local_when_key_is_true(): void
    {
        $this->app->detectEnvironment(fn() => 'local');
        config(['anoofy.allow_insecure_dev_network' => true]);

        $rule = new PublicHttpsUrl($this->fakeResolver);

        $failed = false;
        $failCallback = function (string $message) use (&$failed) {
            $failed = true;
        };

        $rule->validate('store_url', 'http://anoofy-wp.test:28080/wp-json/anoofy/v1', $failCallback);

        $this->assertFalse($failed, 'Expected http://anoofy-wp.test:28080 to be accepted in local with dev key true.');
    }

    public function test_rejects_http_or_internal_ip_in_production_even_if_key_is_true(): void
    {
        $this->app->detectEnvironment(fn() => 'production');
        config(['anoofy.allow_insecure_dev_network' => true]);

        $rule = new PublicHttpsUrl($this->fakeResolver);

        $failed = false;
        $failCallback = function (string $message) use (&$failed) {
            $failed = true;
        };

        $rule->validate('store_url', 'http://anoofy-wp.test:28080/wp-json/anoofy/v1', $failCallback);

        $this->assertTrue($failed, 'Expected http://anoofy-wp.test:28080 to be rejected in production even if dev key is true.');
    }

    public function test_rejects_unresolvable_host_in_local_even_when_key_is_true(): void
    {
        $this->app->detectEnvironment(fn() => 'local');
        config(['anoofy.allow_insecure_dev_network' => true]);

        $rule = new PublicHttpsUrl($this->fakeResolver);

        $failed = false;
        $failCallback = function (string $message) use (&$failed) {
            $failed = true;
        };

        $rule->validate('store_url', 'http://unresolvable-domain.test:28080/wp-json/anoofy/v1', $failCallback);

        $this->assertTrue($failed, 'Expected unresolvable host to be rejected even in local with dev key true.');
    }
}
