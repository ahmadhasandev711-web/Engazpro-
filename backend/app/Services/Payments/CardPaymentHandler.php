<?php

namespace App\Services\Payments;

use App\Contracts\PaymentHandlerInterface;
use App\Models\Party;
use App\Models\Payment;
use App\Models\Shift;
use App\Models\Treasury;
use App\Models\User;

class CardPaymentHandler implements PaymentHandlerInterface
{
    public function supports(string $method): bool
    {
        return in_array(strtoupper($method), ['CARD', 'VISA', 'MASTERCARD', 'MADA']);
    }

    public function handle(
        Payment $payment,
        User $user,
        Party $party,
        Treasury $treasury,
        ?Shift $activeShift
    ): void {
        // بطاقات الدفع الإلكتروني (شبكة/فيزا) - يتم تسجيلها بالمدفوعات وكشف الحساب دون تحريك درج النقدية السائلة
    }
}