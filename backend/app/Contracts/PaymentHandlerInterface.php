<?php

namespace App\Contracts;

use App\Models\Party;
use App\Models\Payment;
use App\Models\Shift;
use App\Models\Treasury;
use App\Models\User;

interface PaymentHandlerInterface
{
    /**
     * هل يدعم هذا المعالج وسيلة الدفع المحددة
     */
    public function supports(string $method): bool;

    /**
     * تنفيذ التأثير المالي لحركة الدفع (خزينة، بنك، أو آجل)
     */
    public function handle(
        Payment $payment,
        User $user,
        Party $party,
        Treasury $treasury,
        ?Shift $activeShift
    ): void;
}