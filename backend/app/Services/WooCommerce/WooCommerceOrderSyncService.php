<?php

namespace App\Services\WooCommerce;

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

    private function buildShortageMessage(
        WcOrderItem $item,
        int $branchId,
        string $branchName,
        int $excludeOrderId,
        int $accountId
    ): ?string {
        if (!$item->product_id) {
            return 'الصنف غير مسجل بالنظام (يجب استيراد الأصناف أولاً)';
        }

        $stockQuery = BranchStock::where('branch_id', $branchId)->where('product_id', $item->product_id);
        $item->product_variant_id ? $stockQuery->where('product_variant_id', $item->product_variant_id) : $stockQuery->whereNull('product_variant_id');
        $rawStock = $stockQuery->value('quantity') ?? 0;

        $reserved = $this->reservationService->reservedQuantity(
            $accountId, $item->product_id, $item->product_variant_id, [$branchId], $excludeOrderId
        );

        $available = Quantity::of($rawStock)->subtract($reserved);
        $required = Quantity::of($item->quantity);

        if ($available->isLessThan($required)) {
            $variant = $item->variant ? " ({$item->variant->name})" : '';
            $name = ($item->product?->name ?? 'صنف غير معروف') . $variant;
            $avail = $available->maxZero()->toDecimalString();
            return "الصنف \"{$name}\" الرصيد المتاح في {$branchName}: {$avail}، والمطلوب: {$required->toDecimalString()}";
        }

        return null;
    }

    /**
     * Dispatch order to mandob (transferring stock from warehouse to VAN branch)
     */
    public function dispatchToMandob(User $user, WcOrder $order, int $mandobId): WcOrder
    {
        $accountId = $user->getAccountId();
        $mandob = User::where(function ($q) use ($accountId) {
            $q->where('id', $accountId)->orWhere('owner_id', $accountId);
        })->findOrFail($mandobId);

        $vanBranch = $this->vanTransferService->resolveVanBranch($accountId, $mandob);

        return DB::transaction(function () use ($user, $accountId, $order, $mandob, $vanBranch) {
            $lockedOrder = WcOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);

            if (!$lockedOrder->status->canTransitionTo(WcOrderStatus::DISPATCHED)) {
                throw new PosDomainException(
                    message: "لا يمكن إسناد الطلب للمندوب وهو بحالة '{$lockedOrder->status->label()}'.",
                    errorCode: 'INVALID_ORDER_STATUS_TRANSITION',
                    statusCode: 422
                );
            }

            if ($vanBranch) {
                $this->vanTransferService->createForDispatch($user, $lockedOrder, $mandob, $vanBranch);
            }

            $lockedOrder->update([
                'mandob_id' => $mandob->id,
                'status' => WcOrderStatus::DISPATCHED,
            ]);

            return $lockedOrder->fresh(['party', 'branch', 'mandob']);
        });
    }

    /**
     * Dispatch order to external courier company (Bosta, Aramex, etc.)
     */
    public function dispatchToCourier(User $user, WcOrder $order, array $courierData): WcOrder
    {
        $accountId = $user->getAccountId();

        $courierName = trim($courierData['courier_name'] ?? '');
        $trackingNumber = !empty($courierData['tracking_number']) ? trim($courierData['tracking_number']) : $order->tracking_number;
        $courierPartyId = !empty($courierData['courier_party_id']) ? (int) $courierData['courier_party_id'] : null;
        $branchId = !empty($courierData['branch_id']) ? (int) $courierData['branch_id'] : $order->branch_id;

        if (!$courierPartyId && !empty($courierName)) {
            $party = Party::where('user_id', $accountId)
                ->where('type', PartyType::COURIER->value)
                ->where('name', $courierName)
                ->first();
            if ($party) {
                $courierPartyId = $party->id;
            }
        }

        if (!$courierPartyId) {
            throw new PosDomainException("يجب اختيار شركة شحن مسجلة بالدفاتر لإسناد الشحنة وتوثيق المديونية المحاسبية.", "COURIER_REQUIRED");
        }

        $courierParty = Party::where('user_id', $accountId)
            ->where('type', PartyType::COURIER->value)
            ->findOrFail($courierPartyId);

        $courierName = $courierParty->name;

        return DB::transaction(function () use ($order, $accountId, $branchId, $courierPartyId, $courierName, $trackingNumber) {
            $lockedOrder = WcOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);

            if (!$lockedOrder->status->canTransitionTo(WcOrderStatus::SHIPPED_VIA_COURIER)) {
                throw new PosDomainException(
                    message: "لا يمكن إسناد الطلب لشركة الشحن وهو بحالة '{$lockedOrder->status->label()}'.",
                    errorCode: 'INVALID_ORDER_STATUS_TRANSITION',
                    statusCode: 422
                );
            }

            $lockedOrder->update([
                'branch_id' => $branchId,
                'shipping_type' => 'COURIER',
                'courier_party_id' => $courierPartyId,
                'courier_name' => $courierName ?: $lockedOrder->courier_name,
                'tracking_number' => $trackingNumber,
                'shipped_at' => now(),
                'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
            ]);

            return $lockedOrder->fresh(['party', 'branch', 'mandob', 'courierParty']);
        });
    }

    /**
     * Deliver order, collect payment, and create official Sales Invoice atomically
     */
    public function deliverOrder(User $user, WcOrder $order, array $deliveryData = []): Invoice
    {
        $accountId = $user->getAccountId();

        $invoice = DB::transaction(function () use ($user, $accountId, $order, $deliveryData) {
            $lockedOrder = WcOrder::where('user_id', $accountId)
                ->lockForUpdate()
                ->findOrFail($order->id);

            if ($lockedOrder->status === WcOrderStatus::DELIVERED && $lockedOrder->invoice_id) {
                return Invoice::findOrFail($lockedOrder->invoice_id);
            }

            if (!$lockedOrder->status->canTransitionTo(WcOrderStatus::DELIVERED)) {
                throw new PosDomainException(
                    message: "لا يمكن تسليم الطلب وهو بحالة '{$lockedOrder->status->label()}'.",
                    errorCode: 'INVALID_ORDER_STATUS_TRANSITION',
                    statusCode: 422
                );
            }

            // تسوية تحويل مخزون سيارة المندوب إن وجد
            $transfer = $this->vanTransferService->settleForDelivery($user, $lockedOrder);
            $executingBranchId = $transfer?->to_branch_id ?? $lockedOrder->mandob?->branch_id ?? $lockedOrder->branch_id;

            // Map items for InvoiceService
            $invoiceItems = [];
            foreach ($lockedOrder->items_snapshot ?? [] as $item) {
                $wcProductId = (int) ($item['product_id'] ?? 0);
                $wcVarId = !empty($item['variation_id']) ? (int) $item['variation_id'] : null;
                $qty = (float) ($item['quantity'] ?? 1);
                if (isset($item['price'])) {
                    $unitPrice = Money::of($item['price'])->getAmount();
                } elseif (isset($item['subtotal'])) {
                    $unitPrice = Money::of($item['subtotal'])->divide(max(1, $qty))->getAmount();
                } else {
                    $unitPrice = Money::of($item['total'] ?? 0)->divide(max(1, $qty))->getAmount();
                }

                $product = Product::where('user_id', $accountId)->where('wc_product_id', $wcProductId)->first();
                if (!$product && !empty($item['product_id'])) {
                    $product = Product::where('user_id', $accountId)->find($item['product_id']);
                }
                $variant = $product && $wcVarId ? $product->variants()->where('wc_variation_id', $wcVarId)->first() : null;

                if ($product) {
                    $invoiceItems[] = [
                        'product_id' => $product->id,
                        'product_variant_id' => $variant?->id,
                        'quantity' => $qty,
                        'unit_price' => $unitPrice,
                        'variant_name' => $variant?->name,
                    ];
                }
            }

            $isPaidOnline = $lockedOrder->payment_status === WcPaymentStatus::PAID_ONLINE;
            $orderTotal = Money::of($lockedOrder->total);
            $rawCollected = isset($deliveryData['collected_amount'])
                ? Money::of($deliveryData['collected_amount'])
                : $orderTotal;

            if ($rawCollected->isGreaterThan($orderTotal)) {
                throw new PosDomainException("المبلغ المحصل ({$rawCollected->getAmount()}) لا يمكن أن يتجاوز إجمالي الطلب ({$orderTotal->getAmount()}).", 'COLLECTED_AMOUNT_EXCEEDS_TOTAL');
            }

            if ($lockedOrder->courier_party_id) {
                if ($isPaidOnline || $rawCollected->isZeroOrNegative()) {
                    $paymentMethod = $deliveryData['payment_method'] ?? 'TRANSFER';
                    $actualCollected = Money::zero();
                    $paidAmount = $orderTotal;
                } else {
                    $paymentMethod = PaymentMethod::COURIER_COD->value;
                    $actualCollected = $rawCollected;
                    $paidAmount = $rawCollected;
                }
            } else {
                $paymentMethod = $deliveryData['payment_method'] ?? ($isPaidOnline ? 'TRANSFER' : 'CASH');
                $actualCollected = $rawCollected;
                $paidAmount = $rawCollected;
            }

            $shippingInfo = '';
            if ($lockedOrder->courier_name) {
                $shippingInfo .= " [شركة شحن: {$lockedOrder->courier_name}";
                if ($lockedOrder->tracking_number) {
                    $shippingInfo .= " - بوليصة: {$lockedOrder->tracking_number}";
                }
                $shippingInfo .= ']';
            } elseif ($lockedOrder->mandob) {
                $shippingInfo .= " [مندوب: {$lockedOrder->mandob->name}]";
            }

            $mandob = $lockedOrder->mandob;
            $mandobTreasury = $mandob?->assignedTreasury;
            $mandobShift = $mandob ? $this->shiftService->getActiveShift($mandob) : null;

            $invoiceData = [
                'type' => 'SALE',
                'party_id' => $lockedOrder->party_id,
                'courier_party_id' => $lockedOrder->courier_party_id,
                'branch_id' => $executingBranchId,
                'items' => $invoiceItems,
                'discount' => $lockedOrder->discount_total,
                'shipping_amount' => $lockedOrder->shipping_cost,
                'paid_amount' => $paidAmount->getAmount(),
                'payment_method' => $paymentMethod,
                'wc_order_id' => $lockedOrder->wc_order_id,
                'notes' => "أوردر ووكومرس #{$lockedOrder->wc_order_id}{$shippingInfo}" . ($lockedOrder->notes ? " | {$lockedOrder->notes}" : ''),
            ];

            // إذا كان الطلب مسنداً لمندوب وكان التحصيل نقداً، تُنسب الفاتورة والخزينة لعهدة المندوب
            if ($mandob && $paymentMethod === 'CASH') {
                $invoiceData['created_by'] = $mandob->id;
                if ($mandobTreasury) {
                    $invoiceData['treasury_id'] = $mandobTreasury->id;
                }
                if ($mandobShift) {
                    $invoiceData['shift_id'] = $mandobShift->id;
                }
            }

            $invoice = $this->invoiceService->createInvoice($user, $invoiceData);

            if ($lockedOrder->courier_party_id && $actualCollected->isPositive()) {
                $this->courierService->recordDeliveryCollection($user, $invoice, $lockedOrder, $actualCollected->getAmount());
            }

            $lockedOrder->update([
                'invoice_id' => $invoice->id,
                'status' => WcOrderStatus::DELIVERED,
                'payment_status' => WcPaymentStatus::COLLECTED,
            ]);

            return $invoice;
        });

        // إشعار WooCommerce خارج كتلة Transaction عبر Job غير متزامن
        try {
            SyncOrderStatusToWooCommerceJob::dispatch($accountId, $order->wc_order_id, 'completed')->afterCommit();
        } catch (\Throwable $e) {
            Log::warning("Failed to dispatch WooCommerce status sync for order #{$order->wc_order_id}: " . $e->getMessage());
        }

        return $invoice;
    }

    /**
     * Mark order as returned
     */
    public function returnOrder(User $user, WcOrder $order, ?string $reason = null): void
    {
        $accountId = $user->getAccountId();

        DB::transaction(function () use ($user, $accountId, $order, $reason) {
            $lockedOrder = WcOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);

            if ($lockedOrder->status === WcOrderStatus::DELIVERED) {
                throw new PosDomainException(
                    message: "لا يمكن إرجاع طلب تم تسليمه وإصدار فاتورته عبر هذا المسار.",
                    errorCode: 'RETURN_AFTER_DELIVERY_UNSUPPORTED',
                    statusCode: 422
                );
            }

            if (!$lockedOrder->status->canTransitionTo(WcOrderStatus::RETURNED)) {
                throw new PosDomainException(
                    message: "لا يمكن تسجيل الطلب كمرتجع وهو بحالة '{$lockedOrder->status->label()}'.",
                    errorCode: 'INVALID_ORDER_STATUS_TRANSITION',
                    statusCode: 422
                );
            }

            $vanWarning = $this->vanTransferService->reverseForReturn($user, $lockedOrder);
            $returnNote = "مرتجع: " . ($reason ?? 'تم رفض الاستلام');
            $notes = $lockedOrder->notes ? $lockedOrder->notes . ' | ' . $returnNote : $returnNote;
            if ($vanWarning) {
                $notes .= ' | ' . $vanWarning;
            }

            $lockedOrder->update([
                'status' => WcOrderStatus::RETURNED,
                'notes' => $notes,
            ]);
        });

        // إشعار WooCommerce بحالة cancelled خارج الـ transaction عبر Job
        try {
            SyncOrderStatusToWooCommerceJob::dispatch($accountId, $order->wc_order_id, 'cancelled')->afterCommit();
        } catch (\Throwable $e) {
            Log::warning("Failed to dispatch WooCommerce status sync for returned order #{$order->wc_order_id}: " . $e->getMessage());
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
        $maxPages = 10;

        foreach (['processing', 'pending', 'on-hold'] as $status) {
            for ($page = 1; $page <= $maxPages; $page++) {
                $orders = $this->apiClient->getOrders($integration, $status, $page, $limit);

                if (empty($orders)) {
                    break;
                }

                foreach ($orders as $orderData) {
                    if (empty($orderData['id'])) {
                        continue;
                    }

                    $wcOrderId = (int) $orderData['id'];
                    $existing = WcOrder::where('user_id', $accountId)->where('wc_order_id', $wcOrderId)->first();

                    $this->ingestionService->ingest($user, $orderData);

                    if ($existing) {
                        $updated++;
                    } else {
                        $imported++;
                    }
                }

                if (count($orders) < $limit) {
                    break;
                }
            }
        }

        return [
            'imported' => $imported,
            'updated' => $updated,
            'total' => $imported + $updated,
        ];
    }
}

