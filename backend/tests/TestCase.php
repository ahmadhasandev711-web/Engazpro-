<?php

namespace Tests;

use App\Contracts\HostResolver;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $fakeResolver = new class implements HostResolver {
            public function resolve(string $host): array
            {
                return ['93.184.216.34'];
            }
        };
        $this->app->instance(HostResolver::class, $fakeResolver);
    }
}
