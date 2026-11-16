<?php

namespace App\Services\WooCommerce;

use App\Enums\InvoiceType;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Exceptions\PosDomainException;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WcOrderItem;
use App\Models\WooCommerceIntegration;
use App\Contracts\WooCommerceApiClientInterface;
use App\Jobs\SyncOrderStatusToWooCommerceJob;
use App\Services\CourierService;
use App\Services\InvoiceService;
use App\Services\ShiftService;
use App\Services\WooCommerce\StockReservationService;
use App\Support\Money;
use App\Support\Quantity;
use Exception;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WooCommerceOrderSyncService
{
    public function __construct(
        protected WooCommerceApiClientInterface $apiClient,
        protected WooCommerceCustomerSyncService $customerSyncService,
        protected InvoiceService $invoiceService,
        protected CourierService $courierService,
        protected WcOrderVanTransferService $vanTransferService,
        protected ShiftService $shiftService,
        protected StockReservationService $reservationService,
        protected WcOrderIngestionService $ingestionService
    ) {}

    /**
     * Confirm order and check stock availability at specified branch
     */
    public function confirmOrder(User $user, WcOrder $order, int $branchId, bool $force = false): WcOrder
    {
        $accountId = $user->getAccountId();
        $branch = Branch::where('user_id', $accountId)->findOrFail($branchId);

        return DB::transaction(function () use ($accountId, $order, $branchId, $branch, $force) {
            $locked = WcOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
            if (!$locked->status->canTransitionTo(WcOrderStatus::CONFIRMED)) {
                throw new PosDomainException("لا يمكن تأكيد الطلب وهو بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
            }

            $locked->loadMissing(['items.product', 'items.variant']);
            $missing = array_values(array_filter($locked->items->map(
                fn($it) => $this->buildShortageMessage($it, $branchId, $branch->name, $locked->id, $accountId)
            )->all()));

            if (!empty($missing) && !$force) {
                throw new PosDomainException("لا يمكن تأكيد الطلب لنقص في المخزون:\n" . implode("\n", $missing), 'INSUFFICIENT_ONLINE_STOCK', 422);
            }

            $notes = $locked->notes;
            if (!empty($missing) && $force) {
                $tag = '[تأكيد مع نقص مخزون: ' . implode(' | ', $missing) . ']';
                $notes = $notes ? "{$notes}\n{$tag}" : $tag;
            }

            $locked->update(['branch_id' => $branchId, 'status' => WcOrderStatus::CONFIRMED, 'notes' => $notes]);
            return $locked->fresh(['party', 'branch']);
        });
    }

    private function buildShortageMessage(WcOrderItem $item, int $branchId, string $branchName, int $excludeOrderId, int $accountId): ?string
    {
        if (!$item->product_id) {
            return 'الصنف غير مسجل بالنظام (يجب استيراد الأصناف أولاً)';
        }

        $stockQuery = BranchStock::where('branch_id', $branchId)->where('product_id', $item->product_id);
        $item->product_variant_id ? $stockQuery->where('product_variant_id', $item->product_variant_id) : $stockQuery->whereNull('product_variant_id');
        $reserved = $this->reservationService->reservedQuantity($accountId, $item->product_id, $item->product_variant_id, [$branchId], $excludeOrderId);

        $available = Quantity::of($stockQuery->value('quantity') ?? 0)->subtract($reserved);
        $required = Quantity::of($item->quantity);
        if (!$available->isLessThan($required)) {
            return null;
        }

        $name = ($item->product?->name ?? 'صنف غير معروف') . ($item->variant ? " ({$item->variant->name})" : '');
        return "الصنف \"{$name}\" الرصيد المتاح في {$branchName}: {$available->maxZero()->toDecimalString()}، والمطلوب: {$required->toDecimalString()}";
    }

    /**
     * Dispatch order to mandob (transferring stock from warehouse to VAN branch)
     */
    public function dispatchToMandob(User $user, WcOrder $order, int $mandobId): WcOrder
    {
        $accountId = $user->getAccountId();
        $mandob = User::where(fn($q) => $q->where('id', $accountId)->orWhere('owner_id', $accountId))->findOrFail($mandobId);
        $vanBranch = $this->vanTransferService->resolveVanBranch($accountId, $mandob);

        return DB::transaction(fn() => $this->assignMandobInsideTransaction($user, $accountId, $order, $mandob, $vanBranch));
    }

    private function assignMandobInsideTransaction(User $user, int $accountId, WcOrder $order, User $mandob, ?Branch $vanBranch): WcOrder
    {
        $lockedOrder = WcOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
        if (!$lockedOrder->status->canTransitionTo(WcOrderStatus::DISPATCHED)) {
            throw new PosDomainException("لا يمكن إسناد الطلب للمندوب وهو بحالة '{$lockedOrder->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
        }
        if ($vanBranch) {
            $this->vanTransferService->createForDispatch($user, $lockedOrder, $mandob, $vanBranch);
        }
        $lockedOrder->update(['mandob_id' => $mandob->id, 'status' => WcOrderStatus::DISPATCHED]);

        return $lockedOrder->fresh(['party', 'branch', 'mandob']);
    }

    /**
     * Dispatch order to external courier company (Bosta, Aramex, etc.)
     */
    public function dispatchToCourier(User $user, WcOrder $order, array $courierData): WcOrder
    {
        $accountId = $user->getAccountId();
        $courierParty = $this->resolveCourierParty($accountId, $courierData);
        $trackingNumber = !empty($courierData['tracking_number']) ? trim($courierData['tracking_number']) : $order->tracking_number;
        $branchId = !empty($courierData['branch_id']) ? (int) $courierData['branch_id'] : $order->branch_id;

        return DB::transaction(fn() => $this->assignCourierInsideTransaction($order, $accountId, $branchId, $courierParty, $trackingNumber));
    }

    private function resolveCourierParty(int $accountId, array $courierData): Party
    {
        $courierPartyId = !empty($courierData['courier_party_id']) ? (int) $courierData['courier_party_id'] : null;
        $courierName = trim($courierData['courier_name'] ?? '');

        if (!$courierPartyId && $courierName !== '') {
            $courierPartyId = Party::where('user_id', $accountId)->where('type', PartyType::COURIER->value)->where('name', $courierName)->value('id');
        }
        if (!$courierPartyId) {
            throw new PosDomainException("يجب اختيار شركة شحن مسجلة بالدفاتر لإسناد الشحنة وتوثيق المديونية المحاسبية.", "COURIER_REQUIRED");
        }

        return Party::where('user_id', $accountId)->where('type', PartyType::COURIER->value)->findOrFail($courierPartyId);
    }

    private function assignCourierInsideTransaction(WcOrder $order, int $accountId, ?int $branchId, Party $courierParty, ?string $trackingNumber): WcOrder
    {
        $lockedOrder = WcOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
        if (!$lockedOrder->status->canTransitionTo(WcOrderStatus::SHIPPED_VIA_COURIER)) {
            throw new PosDomainException("لا يمكن إسناد الطلب لشركة الشحن وهو بحالة '{$lockedOrder->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
        }

        $lockedOrder->update([
            'branch_id' => $branchId, 'shipping_type' => PartyType::COURIER->value,
            'courier_party_id' => $courierParty->id, 'courier_name' => $courierParty->name ?: $lockedOrder->courier_name,
            'tracking_number' => $trackingNumber, 'shipped_at' => now(), 'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
        ]);

        return $lockedOrder->fresh(['party', 'branch', 'mandob', 'courierParty']);
    }

    /**
     * Deliver order, collect payment, and create official Sales Invoice atomically
     */
    public function deliverOrder(User $user, WcOrder $order, array $deliveryData = []): Invoice
    {
        $accountId = $user->getAccountId();
        $invoice = DB::transaction(fn () => $this->deliverOrderInsideTransaction($user, $accountId, $order, $deliveryData));
        $this->dispatchOrderStatusSync($accountId, $order->wc_order_id, 'completed');

        return $invoice;
    }

    private function deliverOrderInsideTransaction(User $user, int $accountId, WcOrder $order, array $deliveryData): Invoice
    {
        $lockedOrder = WcOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
        if ($lockedOrder->status === WcOrderStatus::DELIVERED && $lockedOrder->invoice_id) {
            return Invoice::findOrFail($lockedOrder->invoice_id);
        }
        if (!$lockedOrder->status->canTransitionTo(WcOrderStatus::DELIVERED)) {
            throw new PosDomainException("لا يمكن تسليم الطلب وهو بحالة '{$lockedOrder->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
        }

        $transfer = $this->vanTransferService->settleForDelivery($user, $lockedOrder);
        $executingBranchId = $transfer?->to_branch_id ?? $lockedOrder->mandob?->branch_id ?? $lockedOrder->branch_id;
        $invoiceItems = $this->resolveDeliveryItemsPayload($accountId, $lockedOrder->items_snapshot ?? []);
        $settlement = $this->resolveDeliveryPaymentSettlement($lockedOrder, $deliveryData);
        $invoiceData = $this->buildDeliveryInvoicePayload($lockedOrder, $invoiceItems, $executingBranchId, $settlement);
        $invoice = $this->invoiceService->createInvoice($user, $invoiceData);

        if ($lockedOrder->courier_party_id && $settlement['actual_collected']->isPositive()) {
            $this->courierService->recordDeliveryCollection($user, $invoice, $lockedOrder, $settlement['actual_collected']->getAmount());
        }

        $lockedOrder->update(['invoice_id' => $invoice->id, 'status' => WcOrderStatus::DELIVERED, 'payment_status' => WcPaymentStatus::COLLECTED]);

        return $invoice;
    }

    private function resolveDeliveryItemsPayload(int $accountId, array $itemsSnapshot): array
    {
        $invoiceItems = [];
        foreach ($itemsSnapshot as $item) {
            $qty = Quantity::of($item['quantity'] ?? 1)->toFloat();
            $unitPrice = match (true) {
                isset($item['price']) => Money::of($item['price'])->getAmount(),
                isset($item['subtotal']) => Money::of($item['subtotal'])->divide(max(1, $qty))->getAmount(),
                default => Money::of($item['total'] ?? 0)->divide(max(1, $qty))->getAmount(),
            };

            $product = Product::where('user_id', $accountId)->where('wc_product_id', (int) ($item['product_id'] ?? 0))->first()
                ?? (!empty($item['product_id']) ? Product::where('user_id', $accountId)->find($item['product_id']) : null);
            $variant = ($product && !empty($item['variation_id']))
                ? $product->variants()->where('wc_variation_id', (int) $item['variation_id'])->first()
                : null;

            if ($product) {
                $invoiceItems[] = [
                    'product_id' => $product->id, 'product_variant_id' => $variant?->id,
                    'quantity' => $qty, 'unit_price' => $unitPrice, 'variant_name' => $variant?->name,
                ];
            }
        }

        return $invoiceItems;
    }

    private function resolveDeliveryPaymentSettlement(WcOrder $lockedOrder, array $deliveryData): array
    {
        $isPaidOnline = $lockedOrder->payment_status === WcPaymentStatus::PAID_ONLINE;
        $orderTotal = Money::of($lockedOrder->total);
        $rawCollected = isset($deliveryData['collected_amount']) ? Money::of($deliveryData['collected_amount']) : $orderTotal;

        if ($rawCollected->isGreaterThan($orderTotal)) {
            throw new PosDomainException("المبلغ المحصل ({$rawCollected->getAmount()}) لا يمكن أن يتجاوز إجمالي الطلب ({$orderTotal->getAmount()}).", 'COLLECTED_AMOUNT_EXCEEDS_TOTAL');
        }

        if ($lockedOrder->courier_party_id) {
            if ($isPaidOnline || $rawCollected->isZeroOrNegative()) {
                return ['method' => $deliveryData['payment_method'] ?? PaymentMethod::TRANSFER->value, 'actual_collected' => Money::zero(), 'paid_amount' => $orderTotal];
            }

            return ['method' => PaymentMethod::COURIER_COD->value, 'actual_collected' => $rawCollected, 'paid_amount' => $rawCollected];
        }

        $method = $deliveryData['payment_method'] ?? ($isPaidOnline ? PaymentMethod::TRANSFER->value : PaymentMethod::CASH->value);

        return ['method' => $method, 'actual_collected' => $rawCollected, 'paid_amount' => $rawCollected];
    }

    private function buildDeliveryInvoicePayload(WcOrder $lockedOrder, array $invoiceItems, ?int $executingBranchId, array $settlement): array
    {
        $shippingInfo = $this->formatDeliveryShippingTag($lockedOrder);
        $mandob = $lockedOrder->mandob;
        $invoiceData = [
            'type' => InvoiceType::SALE->value, 'party_id' => $lockedOrder->party_id,
            'courier_party_id' => $lockedOrder->courier_party_id, 'branch_id' => $executingBranchId,
            'items' => $invoiceItems, 'discount' => $lockedOrder->discount_total, 'shipping_amount' => $lockedOrder->shipping_cost,
            'paid_amount' => $settlement['paid_amount']->getAmount(), 'payment_method' => $settlement['method'],
            'wc_order_id' => $lockedOrder->wc_order_id,
            'notes' => "أوردر ووكومرس #{$lockedOrder->wc_order_id}{$shippingInfo}" . ($lockedOrder->notes ? " | {$lockedOrder->notes}" : ''),
        ];

        if ($mandob && $settlement['method'] === PaymentMethod::CASH->value) {
            $invoiceData['created_by'] = $mandob->id;
            if ($treasury = $mandob->assignedTreasury) {
                $invoiceData['treasury_id'] = $treasury->id;
            }
            if ($shift = $this->shiftService->getActiveShift($mandob)) {
                $invoiceData['shift_id'] = $shift->id;
            }
        }

        return $invoiceData;
    }

    private function formatDeliveryShippingTag(WcOrder $lockedOrder): string
    {
        if ($lockedOrder->courier_name) {
            $tracking = $lockedOrder->tracking_number ? " - بوليصة: {$lockedOrder->tracking_number}" : '';
            return " [شركة شحن: {$lockedOrder->courier_name}{$tracking}]";
        }

        return $lockedOrder->mandob ? " [مندوب: {$lockedOrder->mandob->name}]" : '';
    }

    /**
     * Mark order as returned
     */
    public function returnOrder(User $user, WcOrder $order, ?string $reason = null): void
    {
        $accountId = $user->getAccountId();
        DB::transaction(fn() => $this->markOrderReturnedInsideTransaction($user, $accountId, $order, $reason));
        $this->dispatchOrderStatusSync($accountId, $order->wc_order_id, 'cancelled');
    }

    private function markOrderReturnedInsideTransaction(User $user, int $accountId, WcOrder $order, ?string $reason): void
    {
        $lockedOrder = WcOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
        if ($lockedOrder->status === WcOrderStatus::DELIVERED) {
            throw new PosDomainException('لا يمكن إرجاع طلب تم تسليمه وإصدار فاتورته عبر هذا المسار.', 'RETURN_AFTER_DELIVERY_UNSUPPORTED', 422);
        }
        if (!$lockedOrder->status->canTransitionTo(WcOrderStatus::RETURNED)) {
            throw new PosDomainException("لا يمكن تسجيل الطلب كمرتجع وهو بحالة '{$lockedOrder->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
        }

        $vanWarning = $this->vanTransferService->reverseForReturn($user, $lockedOrder);
        $returnNote = 'مرتجع: ' . ($reason ?? 'تم رفض الاستلام');
        $notes = ($lockedOrder->notes ? $lockedOrder->notes . ' | ' . $returnNote : $returnNote) . ($vanWarning ? ' | ' . $vanWarning : '');

        $lockedOrder->update(['status' => WcOrderStatus::RETURNED, 'notes' => $notes]);
    }

    private function dispatchOrderStatusSync(int $accountId, int $wcOrderId, string $wcStatus): void
    {
        try {
            SyncOrderStatusToWooCommerceJob::dispatch($accountId, $wcOrderId, $wcStatus)->afterCommit();
        } catch (\Throwable $e) {
            Log::warning("Failed to dispatch WooCommerce status sync for order #{$wcOrderId}: " . $e->getMessage());
        }
    }

    /**
     * Pull recent orders directly from WooCommerce REST API
     */
    public function pullRecentOrders(User $user, int $limit = 30): array
    {
        $accountId = $user->getAccountId();
        $integration = WooCommerceIntegration::where('user_id', $accountId)->first();
        if (!$integration || !$integration->is_active) {
            throw new PosDomainException('ربط ووكومرس غير مفعل أو لم يتم تهيئته بعد.', 'WOOCOMMERCE_INACTIVE', 422);
        }

        $imported = 0;
        $updated = 0;
        foreach (['processing', 'pending', 'on-hold'] as $status) {
            [$statusImported, $statusUpdated] = $this->pullOrdersByStatus($user, $accountId, $integration, $status, $limit);
            $imported += $statusImported;
            $updated += $statusUpdated;
        }

        return ['imported' => $imported, 'updated' => $updated, 'total' => $imported + $updated];
    }

    private function pullOrdersByStatus(User $user, int $accountId, WooCommerceIntegration $integration, string $status, int $limit): array
    {
        $imported = 0;
        $updated = 0;

        for ($page = 1; $page <= 10; $page++) {
            $orders = $this->apiClient->getOrders($integration, $status, $page, $limit);
            if (empty($orders)) {
                break;
            }
            foreach ($orders as $orderData) {
                if (empty($orderData['id'])) {
                    continue;
                }
                $exists = WcOrder::where('user_id', $accountId)->where('wc_order_id', (int) $orderData['id'])->exists();
                $this->ingestionService->ingest($user, $orderData);
                $exists ? $updated++ : $imported++;
            }
            if (count($orders) < $limit) {
                break;
            }
        }

        return [$imported, $updated];
    }
}

