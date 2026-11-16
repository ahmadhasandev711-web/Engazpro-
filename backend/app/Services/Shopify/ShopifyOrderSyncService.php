<?php

namespace App\Services\Shopify;

use App\Contracts\ShopifyGraphqlClientInterface;
use App\Enums\InvoiceType;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Exceptions\InsufficientStockException;
use App\Exceptions\PosDomainException;
use App\Jobs\SyncFulfillmentToShopifyJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\ShopifyIntegration;
use App\Models\ShopifyOrder;
use App\Models\User;
use App\Services\CourierService;
use App\Services\InvoiceService;
use App\Services\ShiftService;
use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ShopifyOrderSyncService
{
    public function __construct(
        protected ShopifyGraphqlClientInterface $graphqlClient,
        protected InvoiceService $invoiceService,
        protected ShiftService $shiftService,
        protected ShopifyStockReservationService $reservationService,
        protected CourierService $courierService,
        protected ShopifyOrderVanTransferService $vanTransferService,
        protected ShopifyOrderIngestionService $ingestionService
    ) {}

    public function ingestOrderWebhook(User $user, array $payload): ShopifyOrder
    {
        return $this->ingestionService->ingest($user, $payload);
    }

    public function pullRecentOrders(User $user, ShopifyIntegration $integration, int $limit = 25): int
    {
        $cursor = null;
        $count = 0;

        do {
            $page = $this->graphqlClient->getOrdersPage($integration, $cursor, $limit);
            foreach ($page['orders'] as $node) {
                $this->ingestionService->ingest($user, $node);
                $count++;
            }
            $cursor = $page['end_cursor'];
        } while ($page['has_next_page'] && $cursor);

        return $count;
    }

    public function confirmOrder(User $user, ShopifyOrder $order, int $branchId, bool $force = false): ShopifyOrder
    {
        $accountId = $user->getAccountId();
        Branch::where('user_id', $accountId)->findOrFail($branchId);

        return DB::transaction(function () use ($user, $accountId, $order, $branchId, $force) {
            $locked = ShopifyOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
            if (!$locked->status->canTransitionTo(WcOrderStatus::CONFIRMED)) {
                throw new PosDomainException("لا يمكن تأكيد الطلب وهو بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
            }
            if (!$force) {
                $shortages = $this->collectBranchShortages($accountId, $locked, $branchId);
                if (!empty($shortages)) {
                    throw new InsufficientStockException('الكميات المتاحة بالفرع لا تكفي لتأكيد الطلب:<br>' . implode('<br>', $shortages));
                }
            }

            $locked->update([
                'branch_id' => $branchId, 'status' => WcOrderStatus::CONFIRMED,
                'call_confirmed_at' => now(), 'call_confirmed_by' => $user->id,
            ]);

            return $locked->fresh(['party', 'branch', 'mandob']);
        });
    }

    public function dispatchToMandob(User $user, ShopifyOrder $order, int $mandobId): ShopifyOrder
    {
        $accountId = $user->getAccountId();
        $mandob = User::where('owner_id', $accountId)->findOrFail($mandobId);
        $van = $this->vanTransferService->resolveVanBranch($accountId, $mandob);

        return DB::transaction(function () use ($user, $accountId, $order, $mandob, $van) {
            $locked = ShopifyOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
            if (!$locked->status->canTransitionTo(WcOrderStatus::DISPATCHED)) {
                throw new PosDomainException("لا يمكن إسناد الطلب للمندوب وهو بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
            }
            if ($van) {
                $this->vanTransferService->createForDispatch($user, $locked, $mandob, $van);
            }
            $locked->update(['mandob_id' => $mandob->id, 'status' => WcOrderStatus::DISPATCHED]);

            return $locked->fresh(['party', 'branch', 'mandob']);
        });
    }

    public function dispatchToCourier(User $user, ShopifyOrder $order, array $courierData): ShopifyOrder
    {
        $accountId = $user->getAccountId();
        $courierParty = $this->resolveCourierParty($accountId, $courierData);
        $tracking = !empty($courierData['tracking_number']) ? trim((string) $courierData['tracking_number']) : $order->tracking_number;
        $branchId = !empty($courierData['branch_id']) ? (int) $courierData['branch_id'] : $order->branch_id;

        return DB::transaction(function () use ($accountId, $order, $branchId, $courierParty, $tracking) {
            $locked = ShopifyOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
            if (!$locked->status->canTransitionTo(WcOrderStatus::SHIPPED_VIA_COURIER)) {
                throw new PosDomainException("لا يمكن إسناد الطلب لشركة الشحن وهو بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
            }
            $locked->update([
                'branch_id' => $branchId, 'shipping_type' => PartyType::COURIER->value,
                'courier_party_id' => $courierParty->id, 'courier_name' => $courierParty->name ?: $locked->courier_name,
                'tracking_number' => $tracking, 'shipped_at' => now(), 'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
            ]);

            return $locked->fresh(['party', 'branch', 'mandob', 'courierParty']);
        });
    }

    public function deliverOrder(User $user, ShopifyOrder $order, array $deliveryData = []): Invoice
    {
        $accountId = $user->getAccountId();
        $invoice = DB::transaction(fn () => $this->deliverInsideTransaction($user, $accountId, $order, $deliveryData));
        $this->dispatchFulfillmentJob($accountId, $order->id);

        return $invoice;
    }

    public function returnOrder(User $user, ShopifyOrder $order, ?string $reason = null): void
    {
        $accountId = $user->getAccountId();
        DB::transaction(function () use ($user, $accountId, $order, $reason) {
            $locked = ShopifyOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
            if ($locked->status === WcOrderStatus::DELIVERED) {
                throw new PosDomainException('لا يمكن إرجاع طلب تم تسليمه وإصدار فاتورته عبر هذا المسار.', 'RETURN_AFTER_DELIVERY_UNSUPPORTED', 422);
            }
            if (!$locked->status->canTransitionTo(WcOrderStatus::RETURNED)) {
                throw new PosDomainException("لا يمكن تسجيل الطلب كمرتجع وهو بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
            }

            $warn = $this->vanTransferService->reverseForReturn($user, $locked);
            $note = 'مرتجع: ' . ($reason ?? 'تم رفض الاستلام');
            $notes = ($locked->notes ? $locked->notes . ' | ' . $note : $note) . ($warn ? ' | ' . $warn : '');
            $locked->update(['status' => WcOrderStatus::RETURNED, 'notes' => $notes]);
        });
    }

    private function deliverInsideTransaction(User $user, int $accountId, ShopifyOrder $order, array $deliveryData): Invoice
    {
        $locked = ShopifyOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
        if ($locked->status === WcOrderStatus::DELIVERED && $locked->invoice_id) {
            return Invoice::findOrFail($locked->invoice_id);
        }
        if (!$locked->status->canTransitionTo(WcOrderStatus::DELIVERED)) {
            throw new PosDomainException("لا يمكن تسليم الطلب وهو بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_TRANSITION', 422);
        }

        $transfer = $this->vanTransferService->settleForDelivery($user, $locked);
        $branchId = $transfer?->to_branch_id ?? $locked->mandob?->branch_id ?? $locked->branch_id;
        $items = $this->buildInvoiceItems($accountId, $locked->items_snapshot ?? []);
        $settlement = $this->resolvePaymentSettlement($locked, $deliveryData);
        $invoice = $this->invoiceService->createInvoice($user, $this->buildInvoicePayload($locked, $items, $branchId, $settlement));

        if ($locked->courier_party_id && $settlement['actual_collected']->isPositive()) {
            $this->courierService->recordDeliveryCollection($user, $invoice, $locked, $settlement['actual_collected']->getAmount());
        }
        $locked->update(['invoice_id' => $invoice->id, 'status' => WcOrderStatus::DELIVERED, 'payment_status' => WcPaymentStatus::COLLECTED]);

        return $invoice;
    }

    private function collectBranchShortages(int $accountId, ShopifyOrder $order, int $branchId): array
    {
        $items = $order->items()->with(['product:id,name', 'variant:id,name'])->get();
        $productIds = $items->pluck('product_id')->filter()->unique()->values()->all();
        if (empty($productIds)) {
            return [];
        }

        $stocks = BranchStock::withoutGlobalScopes()
            ->where('branch_id', $branchId)->whereIn('product_id', $productIds)->get()
            ->keyBy(fn (BranchStock $bs) => "{$bs->product_id}:" . ($bs->product_variant_id ?? 0));

        return $this->evaluateShortageMessages($items, $stocks, $accountId, $branchId, $order->id);
    }

    private function evaluateShortageMessages($items, $stocks, int $accountId, int $branchId, int $orderId): array
    {
        $shortages = [];
        foreach ($items as $item) {
            if (!$item->product) {
                continue;
            }
            $stockKey = "{$item->product_id}:" . ($item->product_variant_id ?? 0);
            $raw = $stocks->get($stockKey)?->quantity ?? 0;
            $reserved = $this->reservationService->reservedQuantity($accountId, $item->product_id, $item->product_variant_id, [$branchId], $orderId);
            $available = Quantity::of($raw)->subtract($reserved)->maxZero();
            $needed = Quantity::of($item->quantity);

            if ($available->isLessThan($needed)) {
                $label = $item->product->name . ($item->variant ? " ({$item->variant->name})" : '');
                $shortages[] = "• {$label}: المتاح للتسليم {$available->toFloat()} والمطلوب {$needed->toFloat()}";
            }
        }

        return $shortages;
    }

    private function resolveCourierParty(int $accountId, array $courierData): Party
    {
        $id = !empty($courierData['courier_party_id']) ? (int) $courierData['courier_party_id'] : null;
        if (!$id && !empty($courierData['courier_name'])) {
            $id = Party::where('user_id', $accountId)->where('type', PartyType::COURIER->value)->where('name', trim($courierData['courier_name']))->value('id');
        }
        if (!$id) {
            throw new PosDomainException('يجب اختيار شركة شحن مسجلة بالدفاتر لإسناد الشحنة.', 'COURIER_REQUIRED');
        }

        return Party::where('user_id', $accountId)->where('type', PartyType::COURIER->value)->findOrFail($id);
    }

    private function buildInvoiceItems(int $accountId, array $snapshot): array
    {
        $localIds = collect($snapshot)->pluck('product_id')->filter()->unique()->values()->all();
        $shopifyIds = collect($snapshot)->pluck('shopify_product_id')->filter()->unique()->values()->all();
        $products = (empty($localIds) && empty($shopifyIds))
            ? collect()
            : Product::where('user_id', $accountId)->with('variants')
                ->where(fn ($q) => $q->whereIn('id', $localIds)->orWhereIn('shopify_product_id', $shopifyIds))
                ->get();

        return $this->mapSnapshotRowsToInvoiceItems(
            $snapshot,
            $products->keyBy('id'),
            $products->whereNotNull('shopify_product_id')->keyBy('shopify_product_id')
        );
    }

    private function mapSnapshotRowsToInvoiceItems(array $snapshot, $byId, $byShopifyId): array
    {
        $items = [];
        foreach ($snapshot as $row) {
            $product = !empty($row['product_id']) ? $byId->get((int) $row['product_id']) : $byShopifyId->get((int) ($row['shopify_product_id'] ?? 0));
            if (!$product) {
                continue;
            }
            $variant = !empty($row['product_variant_id'])
                ? $product->variants->firstWhere('id', (int) $row['product_variant_id'])
                : (!empty($row['shopify_variant_id']) ? $product->variants->firstWhere('shopify_variant_id', (int) $row['shopify_variant_id']) : null);
            $items[] = [
                'product_id' => $product->id, 'product_variant_id' => $variant?->id,
                'quantity' => Quantity::of($row['quantity'] ?? 1)->toFloat(),
                'unit_price' => Money::of($row['price'] ?? 0)->getAmount(),
                'variant_name' => $variant?->name ?? ($row['variant_name'] ?? null),
            ];
        }

        return $items;
    }

    private function resolvePaymentSettlement(ShopifyOrder $order, array $deliveryData): array
    {
        $isPaidOnline = $order->payment_status === WcPaymentStatus::PAID_ONLINE;
        $orderTotal = Money::of($order->total);
        $raw = isset($deliveryData['collected_amount']) ? Money::of($deliveryData['collected_amount']) : $orderTotal;

        if ($raw->greaterThan($orderTotal)) {
            throw new PosDomainException("المبلغ المحصل ({$raw->getAmount()}) لا يمكن أن يتجاوز إجمالي الطلب ({$orderTotal->getAmount()}).", 'COLLECTED_AMOUNT_EXCEEDS_TOTAL');
        }
        if ($order->courier_party_id) {
            return ($isPaidOnline || $raw->isZeroOrNegative())
                ? ['method' => $deliveryData['payment_method'] ?? PaymentMethod::TRANSFER->value, 'actual_collected' => Money::zero(), 'paid_amount' => $orderTotal]
                : ['method' => PaymentMethod::COURIER_COD->value, 'actual_collected' => $raw, 'paid_amount' => $raw];
        }
        $method = $deliveryData['payment_method'] ?? ($isPaidOnline ? PaymentMethod::TRANSFER->value : PaymentMethod::CASH->value);

        return ['method' => $method, 'actual_collected' => $raw, 'paid_amount' => $raw];
    }

    private function buildInvoicePayload(ShopifyOrder $order, array $items, ?int $branchId, array $settlement): array
    {
        $tag = $order->courier_name ? " [شركة شحن: {$order->courier_name}]" : ($order->mandob ? " [مندوب: {$order->mandob->name}]" : '');
        $ref = $order->shopify_order_number ?: "#{$order->shopify_order_id}";
        $data = [
            'type' => InvoiceType::SALE->value, 'party_id' => $order->party_id, 'courier_party_id' => $order->courier_party_id,
            'branch_id' => $branchId, 'items' => $items, 'discount' => $order->discount_total, 'shipping_amount' => $order->shipping_cost,
            'paid_amount' => $settlement['paid_amount']->getAmount(), 'payment_method' => $settlement['method'],
            'shopify_order_id' => $order->shopify_order_id,
            'notes' => "أوردر شوبيفاي {$ref}{$tag}" . ($order->notes ? " | {$order->notes}" : ''),
        ];
        if ($order->mandob && $settlement['method'] === PaymentMethod::CASH->value) {
            $data['created_by'] = $order->mandob->id;
            $data['treasury_id'] = $order->mandob->assignedTreasury?->id;
            $data['shift_id'] = $this->shiftService->getActiveShift($order->mandob)?->id;
        }

        return $data;
    }

    private function dispatchFulfillmentJob(int $accountId, int $localOrderId): void
    {
        try {
            SyncFulfillmentToShopifyJob::dispatch($accountId, $localOrderId)->afterCommit();
        } catch (\Throwable $e) {
            Log::warning("Failed to dispatch Shopify fulfillment sync for order #{$localOrderId}: " . $e->getMessage());
        }
    }
}
