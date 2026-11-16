<?php

namespace App\Services\Payments;

use App\Contracts\PaymentHandlerInterface;
use App\Enums\LedgerSource;
use App\Enums\PaymentMethod;
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
        return strtoupper($method) === PaymentMethod::CASH->value;
    }

    public function handle(
        Payment $payment,
        User $user,
        Party $party,
        Treasury $treasury,
        ?Shift $activeShift
    ): void {
        $money = Money::of($payment->amount ?? 0);
        if (!$money->isPositive()) {
            return;
        }

        $this->recordTreasuryMovement($treasury, $money, $payment, $party, $user, $activeShift);
    }

    private function recordTreasuryMovement(Treasury $treasury, Money $money, Payment $payment, Party $party, User $user, ?Shift $activeShift): void
    {
        if ($payment->isReceipt()) {
            $this->treasuryService->recordDeposit(
                treasury: $treasury,
                amount: $money,
                sourceType: LedgerSource::PAYMENT->value,
                sourceId: $payment->id,
                actor: $user,
                notes: "سند تحصيل نقدي #{$payment->id} من ({$party->name})",
                shiftId: $activeShift?->id
            );
            return;
        }

        $this->treasuryService->recordWithdrawal(
            treasury: $treasury,
            amount: $money,
            sourceType: LedgerSource::PAYMENT->value,
            sourceId: $payment->id,
            actor: $user,
            notes: "سند صرف نقدي #{$payment->id} إلى ({$party->name})",
            shiftId: $activeShift?->id
        );
    }
}