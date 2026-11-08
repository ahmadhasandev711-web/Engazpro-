<?php

namespace Tests\Concerns;

use ReflectionProperty;

trait SimulatesHttpContext
{
    protected function setUpSimulatesHttpContext(): void
    {
        $ref = new ReflectionProperty($this->app, 'isRunningInConsole');
        $ref->setAccessible(true);
        $ref->setValue($this->app, false);
    }
}
