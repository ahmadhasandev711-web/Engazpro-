<?php

namespace Tests\Unit\Support;

use App\Support\DevNetworkPolicy;
use Tests\TestCase;

class DevNetworkPolicyTest extends TestCase
{
    public function test_returns_false_when_production_and_key_true(): void
    {
        $this->app->detectEnvironment(fn() => 'production');
        config(['anoofy.allow_insecure_dev_network' => true]);

        $this->assertFalse(DevNetworkPolicy::allowsInsecure());
    }

    public function test_returns_false_when_local_and_key_false(): void
    {
        $this->app->detectEnvironment(fn() => 'local');
        config(['anoofy.allow_insecure_dev_network' => false]);

        $this->assertFalse(DevNetworkPolicy::allowsInsecure());
    }

    public function test_returns_true_when_local_and_key_true(): void
    {
        $this->app->detectEnvironment(fn() => 'local');
        config(['anoofy.allow_insecure_dev_network' => true]);

        $this->assertTrue(DevNetworkPolicy::allowsInsecure());
    }
}
