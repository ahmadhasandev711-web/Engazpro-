<?php

namespace App\Support;

use JsonSerializable;
use Stringable;

class Money implements JsonSerializable, Stringable
{
    /**
     * Stored internally as integer cents / piastres to prevent floating-point inaccuracy.
     */
    protected int $cents;
    protected string $currency;

    public function __construct(float|int|string $amount = 0, string $currency = 'EGP')
    {
        $this->cents = (int) round(((float) $amount) * 100);
        $this->currency = $currency;
    }

    public static function fromCents(int $cents, string $currency = 'EGP'): self
    {
        $instance = new self(0, $currency);
        $instance->cents = $cents;
        return $instance;
    }

    public static function of(float|int|string $amount = 0, string $currency = 'EGP'): self
    {
        return new self($amount, $currency);
    }

    public static function zero(string $currency = 'EGP'): self
    {
        return new self(0, $currency);
    }

    public function getAmount(): float
    {
        return round($this->cents / 100, 2);
    }

    public function getCents(): int
    {
        return $this->cents;
    }

    public function getCurrency(): string
    {
        return $this->currency;
    }

    public function add(Money|float|int $other): self
    {
        $cents = $other instanceof Money ? $other->getCents() : (int) round(((float) $other) * 100);
        return self::fromCents($this->cents + $cents, $this->currency);
    }

    public function subtract(Money|float|int $other): self
    {
        $cents = $other instanceof Money ? $other->getCents() : (int) round(((float) $other) * 100);
        return self::fromCents($this->cents - $cents, $this->currency);
    }

    public function multiply(float|int $multiplier): self
    {
        return self::fromCents((int) round($this->cents * (float) $multiplier), $this->currency);
    }

    public function divide(float|int $divisor): self
    {
        if ($divisor == 0) {
            return self::zero($this->currency);
        }
        return self::fromCents((int) round($this->cents / (float) $divisor), $this->currency);
    }

    public function isZero(): bool
    {
        return $this->cents === 0;
    }

    public function isPositive(): bool
    {
        return $this->cents > 0;
    }

    public function isNegative(): bool
    {
        return $this->cents < 0;
    }

    public function equals(Money $other): bool
    {
        return $this->cents === $other->getCents();
    }

    public function greaterThan(Money $other): bool
    {
        return $this->cents > $other->getCents();
    }

    public function isGreaterThan(Money $other): bool
    {
        return $this->greaterThan($other);
    }

    public function lessThan(Money $other): bool
    {
        return $this->cents < $other->getCents();
    }

    public function isLessThan(Money $other): bool
    {
        return $this->lessThan($other);
    }

    public function format(): string
    {
        return number_format($this->getAmount(), 2) . ' ' . $this->currency;
    }

    public function jsonSerialize(): float
    {
        return $this->getAmount();
    }

    public function __toString(): string
    {
        return (string) $this->getAmount();
    }
}
