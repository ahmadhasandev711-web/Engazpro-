<?php

namespace Tests\Unit\Services\Anoofy;

use App\Contracts\AnoofyEventHandlerInterface;
use App\Enums\AnoofyEventType;
use App\Services\Anoofy\AnoofyHandlerRegistry;
use Tests\TestCase;

class AnoofyHandlerRegistryTest extends TestCase
{
    public function test_every_anoofy_event_type_has_registered_handler(): void
    {
        $registry = $this->app->make(AnoofyHandlerRegistry::class);

        foreach (AnoofyEventType::cases() as $eventType) {
            $this->assertTrue(
                $registry->has($eventType),
                "Missing registered handler for AnoofyEventType::{$eventType->name}"
            );

            $handler = $registry->get($eventType);
            $this->assertInstanceOf(
                AnoofyEventHandlerInterface::class,
                $handler,
                "Handler for AnoofyEventType::{$eventType->name} must implement AnoofyEventHandlerInterface"
            );
        }
    }
}
