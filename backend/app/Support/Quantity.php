<?php

namespace App\Support;

use JsonSerializable;
use Stringable;

class Quantity implements JsonSerializable, Stringable
{
    /**
     * Stored internally as integer hundredths (decimal 12,2) to prevent floating-point inaccuracy.
     */
    protected int $hundredths;

    public function __construct(float|int|string $amount = 0)
    {
        if (is_string($amount)) {
            $trimmed = trim($amount);
            if (preg_match('/^-?\d+(\.\d+)?$/', $trimmed)) {
                $isNegative = str_starts_with($trimmed, '-');
                $clean = ltrim($trimmed, '-');
                $parts = explode('.', $clean);
                $whole = (int) ($parts[0] ?? 0);
                $fraction = substr(($parts[1] ?? '') . '00', 0, 2);
                $h = ($whole * 100) + (int) $fraction;
                $this->hundredths = $isNegative ? -$h : $h;
                return;
            }
        }

        $this->hundredths = (int) round(((float) $amount) * 100);
    }

    public static function of(float|int|string $amount = 0): self
    {
        return new self($amount);
    }

    public static function fromHundredths(int $hundredths): self
    {
        $instance = new self(0);
        $instance->hundredths = $hundredths;
        return $instance;
    }

    public static function zero(): self
    {
        return new self(0);
    }

    public function getHundredths(): int
    {
        return $this->hundredths;
    }

    public function add(Quantity|float|int|string $other): self
    {
        $hundredths = $other instanceof Quantity ? $other->getHundredths() : (new self($other))->getHundredths();
        return self::fromHundredths($this->hundredths + $hundredths);
    }

    public function subtract(Quantity|float|int|string $other): self
    {
        $hundredths = $other instanceof Quantity ? $other->getHundredths() : (new self($other))->getHundredths();
        return self::fromHundredths($this->hundredths - $hundredths);
    }

    public function isLessThan(Quantity|float|int|string $other): bool
    {
        $hundredths = $other instanceof Quantity ? $other->getHundredths() : (new self($other))->getHundredths();
        return $this->hundredths < $hundredths;
    }

    public function isGreaterThan(Quantity|float|int|string $other): bool
    {
        $hundredths = $other instanceof Quantity ? $other->getHundredths() : (new self($other))->getHundredths();
        return $this->hundredths > $hundredths;
    }

    public function isLessThanOrEqualTo(Quantity|float|int|string $other): bool
    {
        $hundredths = $other instanceof Quantity ? $other->getHundredths() : (new self($other))->getHundredths();
        return $this->hundredths <= $hundredths;
    }

    public function isGreaterThanOrEqualTo(Quantity|float|int|string $other): bool
    {
        $hundredths = $other instanceof Quantity ? $other->getHundredths() : (new self($other))->getHundredths();
        return $this->hundredths >= $hundredths;
    }

    public function isZero(): bool
    {
        return $this->hundredths === 0;
    }

    public function isPositive(): bool
    {
        return $this->hundredths > 0;
    }

    public function isNegative(): bool
    {
        return $this->hundredths < 0;
    }

    public function maxZero(): self
    {
        return $this->hundredths < 0 ? self::zero() : $this;
    }

    public function toDecimalString(): string
    {
        return number_format($this->hundredths / 100, 2, '.', '');
    }

    public function toFloat(): float
    {
        return round($this->hundredths / 100, 2);
    }

    public function jsonSerialize(): string
    {
        return $this->toDecimalString();
    }

    public function __toString(): string
    {
        return $this->toDecimalString();
    }
}
