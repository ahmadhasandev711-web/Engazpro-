<?php

namespace App\Services\Payments;

use App\Contracts\PaymentHandlerInterface;
use App\Enums\LedgerSource;
use App\Enums\PaymentMethod;
use App\Enums\TreasuryType;
use App\Models\Party;
use App\Models\Payment;
use App\Models\Shift;
use App\Models\Treasury;
use App\Models\User;

use App\Services\TreasuryService;
use App\Support\Money;

class TransferPaymentHandler implements PaymentHandlerInterface
{
    public function __construct(
        protected TreasuryService $treasuryService
    ) {}

    public function supports(string $method): bool
    {
        return in_array(strtoupper($method), [
            PaymentMethod::TRANSFER->value,
            TreasuryType::BANK->value,
            TreasuryType::WALLET->value,
            PaymentMethod::VODAFONE_CASH->value,
            PaymentMethod::INSTAPAY->value,
        ]);
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

        $methodStr = $payment->method instanceof \BackedEnum ? $payment->method->value : (string) $payment->method;
        $targetTreasury = $this->treasuryService->getTreasuryForPaymentMethod($user, $methodStr);

        if ($payment->treasury_id !== $targetTreasury->id) {
            $payment->update(['treasury_id' => $targetTreasury->id]);
        }

        $this->recordTreasuryMovement($targetTreasury, $money, $payment, $party, $user, $activeShift, $methodStr);
    }

    private function recordTreasuryMovement(Treasury $treasury, Money $money, Payment $payment, Party $party, User $user, ?Shift $activeShift, string $methodStr): void
    {
        if ($payment->isReceipt()) {
            $this->treasuryService->recordDeposit(
                treasury: $treasury,
                amount: $money,
                sourceType: LedgerSource::PAYMENT->value,
                sourceId: $payment->id,
                actor: $user,
                notes: "سداد إلكتروني ({$methodStr}) #{$payment->id} من ({$party->name})",
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
            notes: "صرف إلكتروني ({$methodStr}) #{$payment->id} إلى ({$party->name})",
            shiftId: $activeShift?->id
        );
    }
}