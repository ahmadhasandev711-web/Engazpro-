<?php

namespace App\Services\Payments;

use App\Contracts\PaymentHandlerInterface;
use App\Models\Party;
use App\Models\Payment;
use App\Models\Shift;
use App\Models\Treasury;
use App\Models\User;

class CreditPaymentHandler implements PaymentHandlerInterface
{
    public function supports(string $method): bool
    {
        return strtoupper($method) === 'CREDIT';
    }

    public function handle(
        Payment $payment,
        User $user,
        Party $party,
        Treasury $treasury,
        ?Shift $activeShift
    ): void {
        // الآجل: لا حركة نقدية بالخزينة
    }
}