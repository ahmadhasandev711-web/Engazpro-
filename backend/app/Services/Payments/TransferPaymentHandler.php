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

class TransferPaymentHandler implements PaymentHandlerInterface
{
    public function __construct(
        protected TreasuryService $treasuryService
    ) {}

    public function supports(string $method): bool
    {
        return in_array(strtoupper($method), ['TRANSFER', 'BANK', 'WALLET', 'VODAFONE_CASH', 'INSTAPAY']);
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
        $methodStr = $payment->method instanceof \BackedEnum ? $payment->method->value : (string) $payment->method;
        $targetTreasury = $this->treasuryService->getTreasuryForPaymentMethod($user, $methodStr);

        if ($payment->treasury_id !== $targetTreasury->id) {
            $payment->update(['treasury_id' => $targetTreasury->id]);
        }

        if ($payment->isReceipt()) {
            $this->treasuryService->recordDeposit(
                treasury: $targetTreasury,
                amount: $money,
                sourceType: 'PAYMENT',
                sourceId: $payment->id,
                actor: $user,
                notes: "سداد إلكتروني ({$methodStr}) #{$payment->id} من ({$party->name})",
                shiftId: $activeShift?->id
            );
        } else {
            $this->treasuryService->recordWithdrawal(
                treasury: $targetTreasury,
                amount: $money,
                sourceType: 'PAYMENT',
                sourceId: $payment->id,
                actor: $user,
                notes: "صرف إلكتروني ({$methodStr}) #{$payment->id} إلى ({$party->name})",
                shiftId: $activeShift?->id
            );
        }
    }
}