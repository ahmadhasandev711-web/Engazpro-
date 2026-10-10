<?php

namespace App\Services\Payments;

use App\Contracts\PaymentHandlerInterface;
use App\Models\Party;
use App\Models\Payment;
use App\Models\Shift;
use App\Models\Treasury;
use App\Models\User;

class TransferPaymentHandler implements PaymentHandlerInterface
{
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
        // التحويلات البنكية والمحافظ الإلكترونية
    }
}