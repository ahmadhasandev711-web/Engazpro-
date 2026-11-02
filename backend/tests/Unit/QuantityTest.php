<?php

namespace Tests\Unit;

use App\Support\Quantity;
use PHPUnit\Framework\TestCase;

class QuantityTest extends TestCase
{
    public function test_of_parses_integers_and_decimals(): void
    {
        $q1 = Quantity::of(10);
        $this->assertSame(1000, $q1->getHundredths());
        $this->assertSame('10.00', $q1->toDecimalString());

        $q2 = Quantity::of('2.50');
        $this->assertSame(250, $q2->getHundredths());
        $this->assertSame('2.50', $q2->toDecimalString());

        $q3 = Quantity::of('0.05');
        $this->assertSame(5, $q3->getHundredths());

        $q4 = Quantity::of(0);
        $this->assertTrue($q4->isZero());
        $this->assertSame('0.00', $q4->toDecimalString());
    }

    public function test_from_hundredths(): void
    {
        $q = Quantity::fromHundredths(350);
        $this->assertSame(350, $q->getHundredths());
        $this->assertSame('3.50', $q->toDecimalString());
        $this->assertSame(3.5, $q->toFloat());
    }

    public function test_add_and_subtract(): void
    {
        $q1 = Quantity::of('10.00');
        $q2 = Quantity::of('2.50');

        $sum = $q1->add($q2);
        $this->assertSame('12.50', $sum->toDecimalString());

        $diff = $q1->subtract($q2);
        $this->assertSame('7.50', $diff->toDecimalString());
    }

    public function test_comparisons(): void
    {
        $q1 = Quantity::of(10);
        $q2 = Quantity::of(5);

        $this->assertTrue($q2->isLessThan($q1));
        $this->assertFalse($q1->isLessThan($q2));
        $this->assertTrue($q1->isGreaterThan($q2));
    }

    public function test_max_zero(): void
    {
        $negative = Quantity::of(5)->subtract(Quantity::of(10));
        $this->assertTrue($negative->isNegative());
        $this->assertSame('-5.00', $negative->toDecimalString());

        $maxZero = $negative->maxZero();
        $this->assertTrue($maxZero->isZero());
        $this->assertSame('0.00', $maxZero->toDecimalString());

        $positive = Quantity::of(3)->maxZero();
        $this->assertSame('3.00', $positive->toDecimalString());
    }
}
