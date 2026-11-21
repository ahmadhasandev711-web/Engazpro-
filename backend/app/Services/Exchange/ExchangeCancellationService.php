<?php

namespace App\Services\Exchange;

use App\Enums\ExchangeStatus;
use App\Enums\OrderCancelReason;
use App\Enums\WcOrderStatus;
use App\Exceptions\PosDomainException;
use App\Models\Exchange;
use App\Models\OnlineOrder;
use App\Models\User;
use App\Services\InvoiceService;
use Illuminate\Support\Facades\DB;

class ExchangeCancellationService
{
    public function __construct(
        private readonly InvoiceService $invoiceService,
        private readonly StoreCreditService $storeCreditService,
    ) {}

    public function cancel(User $actor, int $exchangeId): Exchange
    {
        if (!$actor->isOwnerOrAdmin()) {
            throw new PosDomainException('عذراً، صلاحية إلغاء أو عكس سند الاستبدال مقتصرة على المالك والإدارة فقط.', 'UNAUTHORIZED_EXCHANGE_CANCEL', 403);
        }

        return DB::transaction(fn () => $this->cancelInsideTransaction($actor, $exchangeId));
    }

    private function cancelInsideTransaction(User $actor, int $exchangeId): Exchange
    {
        $exchange = Exchange::where('user_id', $actor->getAccountId())->lockForUpdate()->findOrFail($exchangeId);
        if ($exchange->status === ExchangeStatus::CANCELLED) {
            throw new PosDomainException('سند الاستبدال ملغي بالفعل.', 'EXCHANGE_ALREADY_CANCELLED', 422);
        }

        if ($exchange->status === ExchangeStatus::AWAITING_COURIER_PICKUP) {
            $this->cancelPendingOnlineExchange($actor, $exchange);
        } else {
            $this->reverseCompletedExchange($actor, $exchange);
        }

        return $exchange->fresh(['items', 'party', 'originalInvoice', 'returnInvoice', 'replacementInvoice']);
    }

    private function cancelPendingOnlineExchange(User $actor, Exchange $exchange): void
    {
        if ($exchange->replacement_online_order_id) {
            $repOrder = OnlineOrder::where('user_id', $actor->getAccountId())->lockForUpdate()->find($exchange->replacement_online_order_id);
            $cancellable = [WcOrderStatus::PENDING_CONFIRMATION, WcOrderStatus::CONFIRMED, WcOrderStatus::PREPARING];
            if ($repOrder && !in_array($repOrder->status, array_merge($cancellable, [WcOrderStatus::CANCELLED, WcOrderStatus::RETURNED]), true)) {
                throw new PosDomainException('شحنة الاستبدال خرجت للتوصيل بالفعل؛ يجب إنهاءها أو إرجاعها من شاشة الطلبات أولاً.', 'EXCHANGE_SHIPMENT_IN_TRANSIT', 422);
            }
            if ($repOrder && in_array($repOrder->status, $cancellable, true)) {
                $repOrder->update([
                    'status' => WcOrderStatus::CANCELLED, 'cancel_reason' => OrderCancelReason::OTHER,
                    'cancelled_at' => now(), 'cancelled_by_user_id' => $actor->id,
                    'notes' => trim(($repOrder->notes ?? '') . "\n[ملغي تلقائياً لإلغاء الاستبدال {$exchange->exchange_number}]"),
                ]);
            }
        }

        $exchange->update(['status' => ExchangeStatus::CANCELLED]);
    }

    private function reverseCompletedExchange(User $actor, Exchange $exchange): void
    {
        $this->storeCreditService->reverseExchangeCredit($actor, $exchange);
        if ($exchange->replacement_invoice_id) {
            $this->invoiceService->deleteInvoice($actor, $exchange->replacement_invoice_id, true);
        }
        if ($exchange->return_invoice_id) {
            $this->invoiceService->deleteInvoice($actor, $exchange->return_invoice_id, true);
        }

        $exchange->update(['status' => ExchangeStatus::CANCELLED, 'completed_at' => null]);
    }
}
