<?php

namespace Tests\Unit\Exchange;

use App\Enums\ExchangeSettlementType;
use App\Services\Exchange\ExchangeSettlementCalculator;
use App\Support\Money;
use PHPUnit\Framework\TestCase;

class ExchangeSettlementCalculatorTest extends TestCase
{
    private ExchangeSettlementCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new ExchangeSettlementCalculator();
    }

    public function test_even_exchange_produces_zero_net_movement(): void
    {
        $plan = $this->calculator->calculate(Money::of(800), Money::of(800), Money::zero(), Money::zero());

        $this->assertSame(ExchangeSettlementType::EVEN_EXCHANGE, $plan['settlement_type']);
        $this->assertEquals(800.0, $plan['exchange_offset']->getAmount());
        $this->assertTrue($plan['net_customer_due']->isZero());
        $this->assertTrue($plan['net_refund']->isZero());
        $this->assertTrue($plan['store_credit_earned']->isZero());
    }

    public function test_upsell_with_shipping_and_partial_store_credit_calculates_exact_due(): void
    {
        $plan = $this->calculator->calculate(
            Money::of(800),
            Money::of(1000),
            Money::of(50),
            Money::of(100)
        );

        $this->assertSame(ExchangeSettlementType::CUSTOMER_PAYS, $plan['settlement_type']);
        $this->assertEquals(800.0, $plan['exchange_offset']->getAmount());
        $this->assertEquals(100.0, $plan['store_credit_used']->getAmount());
        $this->assertEquals(150.0, $plan['net_customer_due']->getAmount());
        $this->assertEquals(150.0, $plan['signed_net_amount']->getAmount());
    }

    public function test_downgrade_can_settle_to_store_credit_or_cash_refund(): void
    {
        $creditPlan = $this->calculator->calculate(
            Money::of(800),
            Money::of(500),
            Money::of(50),
            Money::zero(),
            ExchangeSettlementType::STORE_CREDIT
        );

        $this->assertSame(ExchangeSettlementType::STORE_CREDIT, $creditPlan['settlement_type']);
        $this->assertEquals(550.0, $creditPlan['exchange_offset']->getAmount());
        $this->assertEquals(250.0, $creditPlan['store_credit_earned']->getAmount());
        $this->assertEquals(-250.0, $creditPlan['signed_net_amount']->getAmount());

        $refundPlan = $this->calculator->calculate(
            Money::of(800),
            Money::of(500),
            Money::zero(),
            Money::zero(),
            ExchangeSettlementType::REFUND_CASH
        );

        $this->assertSame(ExchangeSettlementType::REFUND_CASH, $refundPlan['settlement_type']);
        $this->assertEquals(300.0, $refundPlan['net_refund']->getAmount());
        $this->assertTrue($refundPlan['store_credit_earned']->isZero());
    }
}
