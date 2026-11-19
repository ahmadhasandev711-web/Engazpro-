<?php

namespace App\Services\OnlineOrders;

use App\Enums\BranchType;
use App\Enums\EcommercePlatform;
use App\Enums\InvoiceType;
use App\Enums\OnlineOrderCallStatus;
use App\Enums\OrderCancelReason;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use Carbon\Carbon;
use App\Exceptions\PosDomainException;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Invoice;
use App\Models\OnlineOrder;
use App\Models\OnlineOrderItem;
use App\Models\Party;
use App\Models\User;
use App\Services\CourierService;
use App\Services\InvoiceService;
use App\Services\ShiftService;
use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Support\Facades\DB;

class OnlineOrderSyncService
{
    public function __construct(
        private readonly StoreOrderAdapterRegistry $adapters,
        private readonly OnlineOrderIngestionService $ingestionService,
        private readonly OnlineOrderStockReservationService $reservationService,
        private readonly OnlineOrderVanTransferService $vanTransferService,
        private readonly InvoiceService $invoiceService,
        private readonly CourierService $courierService,
        private readonly ShiftService $shiftService,
    ) {}

    public function confirmOrder(User $user, OnlineOrder $order, int $branchId, bool $force = false): OnlineOrder
    {
        $accountId = $user->getAccountId();
        $branch = Branch::where('user_id', $accountId)->findOrFail($branchId);

        return DB::transaction(fn () => $this->confirmInsideTransaction($user, $accountId, $order, $branch, $force));
    }

    public function dispatchToMandob(User $user, OnlineOrder $order, int $mandobId): OnlineOrder
    {
        $accountId = $user->getAccountId();
        $mandob = User::where(fn ($q) => $q->where('id', $accountId)->orWhere('owner_id', $accountId))->findOrFail($mandobId);
        $vanBranch = $this->vanTransferService->resolveVanBranch($accountId, $mandob);

        return DB::transaction(fn () => $this->assignMandobInsideTransaction($user, $accountId, $order, $mandob, $vanBranch));
    }

    public function dispatchToCourier(User $user, OnlineOrder $order, array $courierData): OnlineOrder
    {
        $accountId = $user->getAccountId();
        $courierParty = $this->resolveCourierParty($accountId, $courierData);
        $tracking = !empty($courierData['tracking_number']) ? trim((string) $courierData['tracking_number']) : $order->tracking_number;
        $branchId = !empty($courierData['branch_id']) ? (int) $courierData['branch_id'] : $order->branch_id;

        return DB::transaction(fn () => $this->assignCourierInsideTransaction($order, $accountId, $branchId, $courierParty, $tracking));
    }

    public function deliverOrder(User $user, OnlineOrder $order, array $deliveryData = []): Invoice
    {
        $accountId = $user->getAccountId();
        $invoice = DB::transaction(fn () => $this->deliverInsideTransaction($user, $accountId, $order, $deliveryData));
        $freshOrder = $order->fresh();
        if ($freshOrder) {
            $this->adapters->forPlatform($freshOrder->platform)->dispatchDeliveredSync($freshOrder);
        }

        return $invoice;
    }

    public function returnOrder(User $user, OnlineOrder $order, ?string $reason = null): void
    {
        $accountId = $user->getAccountId();
        DB::transaction(fn () => $this->returnInsideTransaction($user, $accountId, $order, $reason));
        $this->adapters->forPlatform($order->platform)->dispatchCancelledSync($order);
    }

    public function logCallAttempt(
        User $user,
        OnlineOrder $order,
        OnlineOrderCallStatus $callStatus,
        ?string $scheduledAt = null,
        ?string $notes = null
    ): OnlineOrder {
        $accountId = $user->getAccountId();

        return DB::transaction(fn () => $this->logCallInsideTransaction($user, $accountId, $order, $callStatus, $scheduledAt, $notes));
    }

    public function cancelOrder(
        User $user,
        OnlineOrder $order,
        OrderCancelReason $reason,
        ?string $notes = null
    ): OnlineOrder {
        $accountId = $user->getAccountId();
        $cancelled = DB::transaction(fn () => $this->cancelInsideTransaction($user, $accountId, $order, $reason, $notes));
        $this->adapters->forPlatform($cancelled->platform)->dispatchCancelledSync($cancelled);

        return $cancelled;
    }

    /**
     * @return array{imported: int, updated: int, total: int}
     */
    public function pullRecentOrders(User $user, EcommercePlatform $platform, int $limit = 30): array
    {
        $accountId = $user->getAccountId();
        $payloads = $this->adapters->forPlatform($platform)->fetchRecentPayloads($user, $limit);
        $imported = 0;
        $updated = 0;

        foreach ($payloads as $rawOrder) {
            $parsed = $this->adapters->forPlatform($platform)->parsePayload($rawOrder);
            $exists = OnlineOrder::where('user_id', $accountId)->where('platform', $platform->value)->where('external_order_id', $parsed->externalOrderId)->exists();
            $this->ingestionService->ingest($user, $platform, $rawOrder);
            $exists ? $updated++ : $imported++;
        }

        return ['imported' => $imported, 'updated' => $updated, 'total' => $imported + $updated];
    }

    private function confirmInsideTransaction(User $user, int $accountId, OnlineOrder $order, Branch $branch, bool $force): OnlineOrder
    {
        $locked = OnlineOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
        if (!$locked->status->canTransitionTo(WcOrderStatus::CONFIRMED)) {
            throw new PosDomainException("لا يمكن تأكيد الطلب وهو بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
        }

        $missing = $this->collectBranchShortages($accountId, $locked, $branch);
        if (!empty($missing) && !$force) {
            throw new PosDomainException("لا يمكن تأكيد الطلب لنقص في المخزون:\n" . implode("\n", $missing), 'INSUFFICIENT_ONLINE_STOCK', 422);
        }

        $notes = $this->appendForceShortageNote($locked->notes, $missing, $force);
        $locked->update([
            'branch_id' => $branch->id, 'status' => WcOrderStatus::CONFIRMED,
            'call_status' => OnlineOrderCallStatus::CONFIRMED,
            'notes' => $notes, 'call_confirmed_at' => now(),
            'call_confirmed_by' => $user->name, 'call_confirmed_by_user_id' => $user->id,
        ]);

        return $locked->fresh(['party', 'branch', 'mandob']);
    }

    /**
     * @return list<string>
     */
    private function collectBranchShortages(int $accountId, OnlineOrder $locked, Branch $branch): array
    {
        $locked->loadMissing(['items.product', 'items.variant']);

        return array_values(array_filter($locked->items->map(
            fn (OnlineOrderItem $item) => $this->buildShortageMessage($item, $branch, $locked->id, $accountId)
        )->all()));
    }

    private function buildShortageMessage(OnlineOrderItem $item, Branch $branch, int $excludeOrderId, int $accountId): ?string
    {
        if (!$item->product_id) {
            return 'الصنف غير مسجل بالنظام (يجب استيراد الأصناف أولاً)';
        }

        $stockQuery = BranchStock::where('branch_id', $branch->id)->where('product_id', $item->product_id);
        $item->product_variant_id ? $stockQuery->where('product_variant_id', $item->product_variant_id) : $stockQuery->whereNull('product_variant_id');
        $reserved = $this->reservationService->reservedQuantity($accountId, $item->product_id, $item->product_variant_id, [$branch->id], $excludeOrderId);

        $available = Quantity::of($stockQuery->value('quantity') ?? 0)->subtract($reserved);
        $required = Quantity::of($item->quantity);
        if (!$available->isLessThan($required)) {
            return null;
        }

        $name = ($item->product?->name ?? 'صنف غير معروف') . ($item->variant ? " ({$item->variant->name})" : '');

        return "الصنف \"{$name}\" الرصيد المتاح في {$branch->name}: {$available->maxZero()->toDecimalString()}، والمطلوب: {$required->toDecimalString()}";
    }

    private function appendForceShortageNote(?string $notes, array $missing, bool $force): ?string
    {
        if (empty($missing) || !$force) {
            return $notes;
        }
        $tag = '[تأكيد مع نقص مخزون: ' . implode(' | ', $missing) . ']';

        return $notes ? "{$notes}\n{$tag}" : $tag;
    }

    private function assignMandobInsideTransaction(User $user, int $accountId, OnlineOrder $order, User $mandob, ?Branch $vanBranch): OnlineOrder
    {
        $locked = OnlineOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
        if (!$locked->status->canTransitionTo(WcOrderStatus::DISPATCHED)) {
            throw new PosDomainException("لا يمكن إسناد الطلب للمندوب وهو بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
        }
        if ($vanBranch) {
            $this->vanTransferService->createForDispatch($user, $locked, $mandob, $vanBranch);
        }
        $locked->update(['mandob_id' => $mandob->id, 'status' => WcOrderStatus::DISPATCHED]);

        return $locked->fresh(['party', 'branch', 'mandob']);
    }

    private function resolveCourierParty(int $accountId, array $courierData): Party
    {
        $courierPartyId = !empty($courierData['courier_party_id']) ? (int) $courierData['courier_party_id'] : null;
        $courierName = trim((string) ($courierData['courier_name'] ?? ''));
        if (!$courierPartyId && $courierName !== '') {
            $courierPartyId = Party::where('user_id', $accountId)->where('type', PartyType::COURIER->value)->where('name', $courierName)->value('id');
        }
        if (!$courierPartyId) {
            throw new PosDomainException('يجب اختيار شركة شحن مسجلة بالدفاتر لإسناد الشحنة وتوثيق المديونية المحاسبية.', 'COURIER_REQUIRED');
        }

        return Party::where('user_id', $accountId)->where('type', PartyType::COURIER->value)->findOrFail($courierPartyId);
    }

    private function assignCourierInsideTransaction(OnlineOrder $order, int $accountId, ?int $branchId, Party $courierParty, ?string $tracking): OnlineOrder
    {
        $locked = OnlineOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
        if (!$locked->status->canTransitionTo(WcOrderStatus::SHIPPED_VIA_COURIER)) {
            throw new PosDomainException("لا يمكن إسناد الطلب لشركة الشحن وهو بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
        }
        $locked->update([
            'branch_id' => $branchId, 'shipping_type' => PartyType::COURIER->value,
            'courier_party_id' => $courierParty->id, 'courier_name' => $courierParty->name ?: $locked->courier_name,
            'tracking_number' => $tracking, 'shipped_at' => now(), 'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
        ]);

        return $locked->fresh(['party', 'branch', 'mandob', 'courierParty']);
    }

    private function deliverInsideTransaction(User $user, int $accountId, OnlineOrder $order, array $deliveryData): Invoice
    {
        $locked = OnlineOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
        if ($locked->status === WcOrderStatus::DELIVERED && $locked->invoice_id) {
            return Invoice::findOrFail($locked->invoice_id);
        }
        if (!$locked->status->canTransitionTo(WcOrderStatus::DELIVERED)) {
            throw new PosDomainException("لا يمكن تسليم الطلب وهو بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
        }

        $transfer = $this->vanTransferService->settleForDelivery($user, $locked);
        $branchId = $transfer?->to_branch_id ?? $locked->branch_id;
        $settlement = $this->resolvePaymentSettlement($locked, $deliveryData);
        $invoice = $this->invoiceService->createInvoice($user, $this->buildDeliveryInvoicePayload($locked, $accountId, $branchId, $settlement));

        if ($locked->courier_party_id && $settlement['actual_collected']->isPositive()) {
            $this->courierService->recordDeliveryCollection($user, $invoice, $locked, $settlement['actual_collected']->getAmount());
        }
        $locked->update(['invoice_id' => $invoice->id, 'status' => WcOrderStatus::DELIVERED, 'payment_status' => WcPaymentStatus::COLLECTED]);

        return $invoice;
    }

    private function resolveDeliveryItemsPayload(int $accountId, OnlineOrder $order): array
    {
        $adapter = $this->adapters->forPlatform($order->platform);
        $items = [];
        foreach ($order->items_snapshot ?? [] as $row) {
            $resolved = $adapter->resolveItemProduct($accountId, $row);
            if ($resolved['product']) {
                $qty = Quantity::of($row['quantity'] ?? 1)->toFloat();
                $items[] = [
                    'product_id' => $resolved['product']->id, 'product_variant_id' => $resolved['variant']?->id,
                    'quantity' => $qty, 'unit_price' => $this->resolveSnapshotUnitPrice($row, $qty),
                    'variant_name' => $resolved['variant']?->name ?? ($row['variant_name'] ?? null),
                ];
            }
        }

        return $items;
    }

    private function resolveSnapshotUnitPrice(array $row, float $qty): float
    {
        return match (true) {
            isset($row['price']) => Money::of($row['price'])->getAmount(),
            isset($row['subtotal']) => Money::of($row['subtotal'])->divide(max(1, $qty))->getAmount(),
            default => Money::of($row['total'] ?? 0)->divide(max(1, $qty))->getAmount(),
        };
    }

    private function resolvePaymentSettlement(OnlineOrder $locked, array $deliveryData): array
    {
        $isPaidOnline = $locked->payment_status === WcPaymentStatus::PAID_ONLINE;
        $orderTotal = Money::of($locked->total);
        $collected = isset($deliveryData['collected_amount']) ? Money::of($deliveryData['collected_amount']) : $orderTotal;
        if ($collected->isGreaterThan($orderTotal)) {
            throw new PosDomainException("المبلغ المحصل ({$collected->getAmount()}) لا يمكن أن يتجاوز إجمالي الطلب ({$orderTotal->getAmount()}).", 'COLLECTED_AMOUNT_EXCEEDS_TOTAL');
        }
        if ($locked->courier_party_id) {
            return ($isPaidOnline || $collected->isZeroOrNegative())
                ? ['method' => $deliveryData['payment_method'] ?? PaymentMethod::TRANSFER->value, 'actual_collected' => Money::zero(), 'paid_amount' => $orderTotal]
                : ['method' => PaymentMethod::COURIER_COD->value, 'actual_collected' => $collected, 'paid_amount' => $collected];
        }
        $method = $deliveryData['payment_method'] ?? ($isPaidOnline ? PaymentMethod::TRANSFER->value : PaymentMethod::CASH->value);

        return ['method' => $method, 'actual_collected' => $collected, 'paid_amount' => $collected];
    }

    private function buildDeliveryInvoicePayload(OnlineOrder $locked, int $accountId, ?int $branchId, array $settlement): array
    {
        $adapter = $this->adapters->forPlatform($locked->platform);
        $tag = $this->formatShippingTag($locked);
        $data = array_merge([
            'type' => InvoiceType::SALE->value, 'party_id' => $locked->party_id, 'courier_party_id' => $locked->courier_party_id,
            'branch_id' => $branchId, 'items' => $this->resolveDeliveryItemsPayload($accountId, $locked),
            'discount' => $locked->discount_total, 'tax' => $locked->tax_total ?? 0, 'shipping_amount' => $locked->shipping_cost,
            'paid_amount' => $settlement['paid_amount']->getAmount(), 'payment_method' => $settlement['method'],
            'online_order_id' => $locked->id,
            'notes' => "أوردر {$locked->platform->label()} {$locked->displayReference()}{$tag}" . ($locked->notes ? " | {$locked->notes}" : ''),
        ], $adapter->invoiceReferencePayload($locked));

        return $this->attachMandobCashContext($data, $locked, $settlement['method']);
    }

    private function attachMandobCashContext(array $data, OnlineOrder $locked, string $method): array
    {
        if ($locked->mandob && $method === PaymentMethod::CASH->value) {
            $data['created_by'] = $locked->mandob->id;
            $data['treasury_id'] = $locked->mandob->assignedTreasury?->id;
            $data['shift_id'] = $this->shiftService->getActiveShift($locked->mandob)?->id;
        }

        return $data;
    }

    private function formatShippingTag(OnlineOrder $locked): string
    {
        if ($locked->courier_name) {
            $tracking = $locked->tracking_number ? " - بوليصة: {$locked->tracking_number}" : '';

            return " [شركة شحن: {$locked->courier_name}{$tracking}]";
        }

        return $locked->mandob ? " [مندوب: {$locked->mandob->name}]" : '';
    }

    private function returnInsideTransaction(User $user, int $accountId, OnlineOrder $order, ?string $reason): void
    {
        $locked = OnlineOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
        if ($locked->status === WcOrderStatus::DELIVERED) {
            throw new PosDomainException('لا يمكن إرجاع طلب تم تسليمه وإصدار فاتورته عبر هذا المسار.', 'RETURN_AFTER_DELIVERY_UNSUPPORTED', 422);
        }
        if (!$locked->status->canTransitionTo(WcOrderStatus::RETURNED)) {
            throw new PosDomainException("لا يمكن تسجيل الطلب كمرتجع وهو بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
        }

        $warn = $this->vanTransferService->reverseForReturn($user, $locked);
        $note = 'مرتجع: ' . ($reason ?? 'تم رفض الاستلام');
        $notes = ($locked->notes ? $locked->notes . ' | ' . $note : $note) . ($warn ? ' | ' . $warn : '');
        $locked->update([
            'status' => WcOrderStatus::RETURNED,
            'cancel_reason' => $locked->cancel_reason ?? OrderCancelReason::CUSTOMER_REJECTED,
            'notes' => $notes,
        ]);
    }

    private function logCallInsideTransaction(
        User $user,
        int $accountId,
        OnlineOrder $order,
        OnlineOrderCallStatus $callStatus,
        ?string $scheduledAt,
        ?string $notes
    ): OnlineOrder {
        $locked = OnlineOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
        if ($locked->status !== WcOrderStatus::PENDING_CONFIRMATION) {
            throw new PosDomainException("لا يمكن تسجيل مكالمة كول سنتر لطلب بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_FOR_CALL_LOG', 422);
        }

        $cleanNotes = $notes !== null && trim($notes) !== '' ? trim($notes) : $locked->call_notes;
        $locked->update([
            'call_status' => $callStatus,
            'call_attempts_count' => (int) ($locked->call_attempts_count ?? 0) + 1,
            'last_call_attempt_at' => now(),
            'last_call_attempt_by' => $user->name,
            'last_call_attempt_by_user_id' => $user->id,
            'call_scheduled_at' => ($callStatus === OnlineOrderCallStatus::CALLBACK_SCHEDULED && $scheduledAt) ? Carbon::parse($scheduledAt) : null,
            'call_notes' => $cleanNotes,
        ]);

        return $locked->fresh(['party', 'branch', 'mandob', 'courierParty', 'lastCallAttemptByUser']);
    }

    private function cancelInsideTransaction(
        User $user,
        int $accountId,
        OnlineOrder $order,
        OrderCancelReason $reason,
        ?string $notes
    ): OnlineOrder {
        $locked = OnlineOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
        if (!$locked->status->canTransitionTo(WcOrderStatus::CANCELLED)) {
            throw new PosDomainException("لا يمكن إلغاء الطلب وهو بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
        }

        $cleanNotes = $notes !== null && trim($notes) !== '' ? trim($notes) : null;
        $tag = '[ملغي: ' . $reason->label() . ($cleanNotes ? " - {$cleanNotes}" : '') . ']';
        $locked->update([
            'status' => WcOrderStatus::CANCELLED, 'cancel_reason' => $reason,
            'cancel_notes' => $cleanNotes, 'cancelled_at' => now(),
            'cancelled_by_user_id' => $user->id, 'notes' => $locked->notes ? "{$locked->notes}\n{$tag}" : $tag,
        ]);

        return $locked->fresh(['party', 'branch', 'mandob', 'courierParty', 'cancelledByUser']);
    }

    public function transferOrderBranch(User $actor, OnlineOrder $order, int $targetBranchId, ?string $reason = null): OnlineOrder
    {
        $accountId = $actor->getAccountId();
        $targetBranch = Branch::where('user_id', $accountId)
            ->whereIn('type', BranchType::fixedValues())
            ->where('is_active', true)
            ->findOrFail($targetBranchId);

        return DB::transaction(fn () => $this->executeTransferBranch($actor, $accountId, $order, $targetBranch, $reason));
    }

    private function executeTransferBranch(User $actor, int $accountId, OnlineOrder $order, Branch $targetBranch, ?string $reason): OnlineOrder
    {
        $locked = OnlineOrder::where('user_id', $accountId)->with('branch')->lockForUpdate()->findOrFail($order->id);
        $allowed = [WcOrderStatus::PENDING_CONFIRMATION, WcOrderStatus::CONFIRMED, WcOrderStatus::PREPARING];
        if (!in_array($locked->status, $allowed, true)) {
            throw new PosDomainException("لا يمكن تحويل الطلب لفرع آخر وهو بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
        }
        if ((int) $locked->branch_id === (int) $targetBranch->id) {
            throw new PosDomainException('الطلب موجّه بالفعل إلى هذا الفرع.', 'SAME_TARGET_BRANCH', 422);
        }
        $fromName = $locked->branch?->name ?? 'غير محدد';
        $cleanReason = $reason !== null && trim($reason) !== '' ? ' - السبب: ' . trim($reason) : '';
        $tag = "[تحويل فرع: من ({$fromName}) إلى ({$targetBranch->name}) بواسطة {$actor->name}{$cleanReason}]";
        $locked->update([
            'branch_id' => $targetBranch->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'notes' => $locked->notes ? "{$locked->notes}\n{$tag}" : $tag,
        ]);

        return $locked->fresh(['party', 'branch', 'mandob', 'courierParty']);
    }
}
