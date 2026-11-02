<?php

namespace Tests\Unit;

use App\Enums\WcOrderStatus;
use PHPUnit\Framework\TestCase;

class WcOrderStatusReservesStockTest extends TestCase
{
    public function test_reserves_branch_stock_for_active_store_orders(): void
    {
        $this->assertTrue(WcOrderStatus::PENDING_CONFIRMATION->reservesBranchStock());
        $this->assertTrue(WcOrderStatus::CONFIRMED->reservesBranchStock());
        $this->assertTrue(WcOrderStatus::PREPARING->reservesBranchStock());
        $this->assertTrue(WcOrderStatus::SHIPPED_VIA_COURIER->reservesBranchStock());

        $this->assertFalse(WcOrderStatus::DISPATCHED->reservesBranchStock());
        $this->assertFalse(WcOrderStatus::DELIVERED->reservesBranchStock());
        $this->assertFalse(WcOrderStatus::PARTIALLY_DELIVERED->reservesBranchStock());
        $this->assertFalse(WcOrderStatus::RETURNED->reservesBranchStock());
        $this->assertFalse(WcOrderStatus::CANCELLED->reservesBranchStock());
    }

    public function test_reserving_cases_returns_exact_four_statuses(): void
    {
        $cases = WcOrderStatus::reservingCases();

        $this->assertCount(4, $cases);
        $this->assertContains(WcOrderStatus::PENDING_CONFIRMATION, $cases);
        $this->assertContains(WcOrderStatus::CONFIRMED, $cases);
        $this->assertContains(WcOrderStatus::PREPARING, $cases);
        $this->assertContains(WcOrderStatus::SHIPPED_VIA_COURIER, $cases);
    }
}
