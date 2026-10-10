<?php

namespace App\Services\Payments;

use App\Contracts\PaymentHandlerInterface;
use App\Models\Party;
use App\Models\Payment;
use App\Models\Shift;
use App\Models\Treasury;
use App\Models\User;
use App\Services\TreasuryService;
use App\Support\Money;

class CashPaymentHandler implements PaymentHandlerInterface
{
    public function __construct(
        protected TreasuryService $treasuryService
    ) {}

    public function supports(string $method): bool
    {
        return strtoupper($method) === 'CASH';
    }

    public function handle(
        Payment $payment,
        User $user,
        Party $party,
        Treasury $treasury,
        ?Shift $activeShift
    ): void {
        $amount = (float) $payment->amount;
        if ($amount <= 0) {
            return;
        }

        $money = Money::of($amount);

        if ($payment->isReceipt()) {
            $this->treasuryService->recordDeposit(
                treasury: $treasury,
                amount: $money,
                sourceType: 'PAYMENT',
                sourceId: $payment->id,
                actor: $user,
                notes: "سند تحصيل نقدي #{$payment->id} من ({$party->name})",
                shiftId: $activeShift?->id
            );
        } else {
            $this->treasuryService->recordWithdrawal(
                treasury: $treasury,
                amount: $money,
                sourceType: 'PAYMENT',
                sourceId: $payment->id,
                actor: $user,
                notes: "سند صرف نقدي #{$payment->id} إلى ({$party->name})",
                shiftId: $activeShift?->id
            );
        }
    }
}