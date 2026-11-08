<?php

namespace App\Services\Anoofy;

use App\Contracts\AnoofyEventHandlerInterface;
use App\Enums\AnoofyEventType;
use InvalidArgumentException;

class AnoofyHandlerRegistry
{
    /**
     * @var array<string, class-string<AnoofyEventHandlerInterface>>
     */
    private array $handlers = [];

    public function register(AnoofyEventType $type, string $handlerClass): self
    {
        $this->handlers[$type->value] = $handlerClass;
        return $this;
    }

    public function get(AnoofyEventType $type): AnoofyEventHandlerInterface
    {
        $handlerClass = $this->handlers[$type->value] ?? null;
        if ($handlerClass === null) {
            throw new InvalidArgumentException("لا يوجد معالج مسجل للحدث: {$type->value}");
        }

        return app($handlerClass);
    }

    public function has(AnoofyEventType $type): bool
    {
        return isset($this->handlers[$type->value]);
    }
}
