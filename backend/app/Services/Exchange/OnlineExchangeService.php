<?php

namespace App\Services\Exchange;

use App\Enums\DocumentType;
use App\Enums\ExchangeItemDirection;
use App\Enums\ExchangeSettlementType;
use App\Enums\ExchangeSource;
use App\Enums\ExchangeStatus;
use App\Enums\PaymentMethod;
use App\Enums\ReturnItemCondition;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Exceptions\PosDomainException;
use App\Models\Exchange;
use App\Models\ExchangeItem;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\OnlineOrder;
use App\Models\OnlineOrderItem;
use App\Models\Product;
use App\Models\User;
use App\Services\BranchScopeService;
use App\Services\CourierService;
use App\Services\DocumentSequenceService;
use App\Services\ShiftService;
use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Support\Facades\DB;

class OnlineExchangeService
{
    public function __construct(
        private readonly ExchangeSettlementCalculator $calculator,
        private readonly ExchangeInvoiceComposer $composer,
        private readonly StoreCreditService $storeCreditService,
        private readonly DocumentSequenceService $sequenceService,
        private readonly CourierService $courierService,
        private readonly ShiftService $shiftService,
        private readonly BranchScopeService $branchScopeService,
    ) {}

    public function swapBeforeDelivery(User $user, OnlineOrder $order, array $data): OnlineOrder
    {
        return DB::transaction(function () use ($user, $order, $data) {
            $locked = OnlineOrder::where('user_id', $user->getAccountId())->lockForUpdate()->findOrFail($order->id);
            $allowed = [WcOrderStatus::PENDING_CONFIRMATION, WcOrderStatus::CONFIRMED, WcOrderStatus::PREPARING];
            if (!in_array($locked->status, $allowed, true)) {
                throw new PosDomainException("لا يمكن تبديل المقاسات/الأصناف والطلب بحالة '{$locked->status->label()}'.", 'INVALID_ORDER_STATUS_FOR_SWAP', 422);
            }

            $prepared = $this->prepareReplacementItems($user->getAccountId(), $data['items']);
            $this->replaceOnlineOrderItems($locked, $prepared);
            $this->recalculateOrderTotalsAndNote($user, $locked, $prepared, $data['notes'] ?? null);

            return $locked->fresh(['party', 'branch', 'mandob', 'courierParty', 'items.product', 'items.variant']);
        });
    }

    public function createPostDeliveryExchange(User $user, OnlineOrder $order, array $data): Exchange
    {
        return DB::transaction(function () use ($user, $order, $data) {
            $accountId = $user->getAccountId();
            $locked = OnlineOrder::where('user_id', $accountId)->lockForUpdate()->findOrFail($order->id);
            $this->assertEligibleForPostDeliveryExchange($user, $locked);

            $originalInvoice = Invoice::where('user_id', $accountId)->with('items')->lockForUpdate()->findOrFail($locked->invoice_id);
            $returned = $this->prepareReturnedItems($accountId, $originalInvoice, $data['returned_items']);
            $replacement = $this->prepareReplacementItems($accountId, $data['replacement_items']);
            $plan = $this->calculatePostDeliveryPlan($returned, $replacement, $data);
            $this->assertWalletPartyPresent($locked, $plan);

            $exchange = $this->persistPendingOnlineExchange($user, $locked, $originalInvoice, $plan, $data);
            $this->composer->persistExchangeItems($exchange, ExchangeItemDirection::RETURNED, $returned, null);
            $this->composer->persistExchangeItems($exchange, ExchangeItemDirection::REPLACEMENT, $replacement, null);
            $replacementOrder = $this->createReplacementOnlineOrder($locked, $exchange, $replacement, $plan, $data);
            $exchange->update(['replacement_online_order_id' => $replacementOrder->id]);

            return $exchange->fresh(['items', 'party', 'originalOnlineOrder', 'replacementOnlineOrder']);
        });
    }

    public function completeDeliveredExchange(User $user, OnlineOrder $replacementOrder, ?int $branchId, array $deliveryData): Invoice
    {
        $accountId = $user->getAccountId();
        $exchange = Exchange::where('user_id', $accountId)->with('items')->lockForUpdate()->findOrFail($replacementOrder->exchange_id);
        if ($exchange->status !== ExchangeStatus::AWAITING_COURIER_PICKUP) {
            throw new PosDomainException('طلب الاستبدال هذا مكتمل أو ملغي بالفعل.', 'EXCHANGE_NOT_PENDING_DELIVERY', 422);
        }

        $originalInvoice = $exchange->original_invoice_id
            ? Invoice::where('user_id', $accountId)->with('items')->lockForUpdate()->findOrFail($exchange->original_invoice_id)
            : null;
        $plan = $this->rebuildPlanFromExchange($exchange);
        [$method, $collected] = $this->resolveDeliveredCollection($replacementOrder, $plan['net_customer_due'], $deliveryData);

        $returnedPayload = $this->mapExchangeItemsForInvoice($exchange->items->where('direction', ExchangeItemDirection::RETURNED));
        $replacementPayload = $this->mapExchangeItemsForInvoice($exchange->items->where('direction', ExchangeItemDirection::REPLACEMENT));
        $targetBranchId = $branchId ?? $exchange->branch_id;
        $refundChannel = $this->resolveOnlineRefundChannel($exchange);

        $returnInvoice = $this->composer->createReturnInvoice($user, $exchange, $originalInvoice, $returnedPayload, $plan, $refundChannel, null, $targetBranchId, $exchange->notes);
        $replacementInvoice = $this->composer->createReplacementInvoice($user, $exchange, $replacementPayload, $plan, $method, $collected, $this->buildOnlineSaleExtras($replacementOrder, $targetBranchId, $method));

        $this->finalizeCompletedOnlineExchange($user, $exchange, $replacementOrder, $replacementInvoice, $returnInvoice, $plan, $collected);

        return $replacementInvoice;
    }

    public function cancelCourierExchange(OnlineOrder $replacementOrder): void
    {
        if (!$replacementOrder->is_exchange || !$replacementOrder->exchange_id) {
            return;
        }
        $exchange = Exchange::where('user_id', $replacementOrder->user_id)->lockForUpdate()->find($replacementOrder->exchange_id);
        if ($exchange && $exchange->status === ExchangeStatus::AWAITING_COURIER_PICKUP) {
            $exchange->update(['status' => ExchangeStatus::CANCELLED]);
        }
    }

    private function assertEligibleForPostDeliveryExchange(User $user, OnlineOrder $locked): void
    {
        if (!in_array($locked->status, [WcOrderStatus::DELIVERED, WcOrderStatus::PARTIALLY_DELIVERED], true) || !$locked->invoice_id) {
            throw new PosDomainException('طلب شحنة الاستبدال متاح فقط للطلبات الأونلاين التي تم تسليمها وإصدار فاتورتها.', 'ORDER_NOT_DELIVERED_YET', 422);
        }
        if ($locked->branch_id) {
            $this->branchScopeService->assertCanAccessBranch($user, $locked->branch_id, 'عذراً، لا تملك صلاحية عمل استبدال لطلب تابع لفرع آخر.');
        }
    }

    private function prepareReturnedItems(int $accountId, Invoice $originalInvoice, array $rows): array
    {
        $prepared = [];
        foreach ($rows as $row) {
            $product = Product::where('user_id', $accountId)->findOrFail((int) $row['product_id']);
            $variantId = !empty($row['product_variant_id']) ? (int) $row['product_variant_id'] : null;
            $variant = $variantId ? $product->variants()->findOrFail($variantId) : null;
            $matched = $originalInvoice->items->first(fn (InvoiceItem $i) => (int) $i->product_id === $product->id && (int) ($i->product_variant_id ?? 0) === (int) ($variantId ?? 0));
            if (!$matched) {
                throw new PosDomainException("الصنف '{$product->name}' غير موجود في فاتورة الطلب الأصلية.", 'RETURN_ITEM_NOT_IN_PARENT', 422);
            }
            $this->assertNoDuplicatePendingReturn($accountId, $originalInvoice->id, $product->id, $variantId, Quantity::of($row['quantity']));
            $qty = Quantity::of($row['quantity'])->toFloat();
            $unitPrice = $this->prorateDiscountedUnitPrice($originalInvoice, $matched);
            $cond = ReturnItemCondition::tryFrom((string) ($row['condition'] ?? ReturnItemCondition::SELLABLE->value)) ?? ReturnItemCondition::SELLABLE;
            $prepared[] = ['product_id' => $product->id, 'product_variant_id' => $variant?->id, 'product_name' => $product->name, 'variant_name' => $variant?->name, 'quantity' => $qty, 'unit_price' => $unitPrice->getAmount(), 'total' => $unitPrice->multiply($qty)->getAmount(), 'condition' => $cond];
        }

        return $prepared;
    }

    private function assertNoDuplicatePendingReturn(int $accountId, int $originalInvoiceId, int $productId, ?int $variantId, Quantity $requested): void
    {
        $pending = ExchangeItem::where('user_id', $accountId)
            ->where('direction', ExchangeItemDirection::RETURNED->value)
            ->where('product_id', $productId)
            ->when($variantId, fn ($q) => $q->where('product_variant_id', $variantId), fn ($q) => $q->whereNull('product_variant_id'))
            ->whereHas('exchange', fn ($q) => $q->where('original_invoice_id', $originalInvoiceId)->where('status', ExchangeStatus::AWAITING_COURIER_PICKUP->value))
            ->sum('quantity');

        if (Quantity::of($pending)->isPositive() && Quantity::of($pending)->isGreaterThan(Quantity::zero())) {
            $priorReturned = InvoiceItem::whereHas('invoice', fn ($q) => $q->where('user_id', $accountId)->where('parent_invoice_id', $originalInvoiceId))
                ->where('product_id', $productId)
                ->when($variantId, fn ($q) => $q->where('product_variant_id', $variantId), fn ($q) => $q->whereNull('product_variant_id'))
                ->sum('quantity');
            $origQty = InvoiceItem::where('invoice_id', $originalInvoiceId)->where('product_id', $productId)->when($variantId, fn ($q) => $q->where('product_variant_id', $variantId), fn ($q) => $q->whereNull('product_variant_id'))->sum('quantity');
            $available = Quantity::of($origQty)->subtract(Quantity::of($priorReturned))->subtract(Quantity::of($pending))->maxZero();
            if ($requested->isGreaterThan($available)) {
                throw new PosDomainException("توجد شحنة استبدال معلقة بالفعل لهذا الصنف، المتبقي المتاح: {$available->toFloat()}.", 'PENDING_EXCHANGE_EXISTS', 422);
            }
        }
    }

    private function prorateDiscountedUnitPrice(Invoice $invoice, InvoiceItem $item): Money
    {
        $sub = Money::of($invoice->subtotal ?? 0);
        $disc = Money::of($invoice->discount ?? 0);
        $unit = Money::of($item->unit_price ?? 0);
        if (!$disc->isPositive() || !$sub->isPositive()) {
            return $unit;
        }

        return $unit->multiply(max(0, $sub->subtract($disc)->getAmount() / $sub->getAmount()));
    }

    private function prepareReplacementItems(int $accountId, array $rows): array
    {
        $prepared = [];
        foreach ($rows as $row) {
            $product = Product::where('user_id', $accountId)->findOrFail((int) $row['product_id']);
            $variantId = !empty($row['product_variant_id']) ? (int) $row['product_variant_id'] : null;
            $variant = $variantId ? $product->variants()->findOrFail($variantId) : null;
            $qty = Quantity::of($row['quantity'])->toFloat();
            $unitPrice = Money::of($row['unit_price'] ?? $variant?->selling_price ?? $product->selling_price ?? 0);
            $prepared[] = ['product_id' => $product->id, 'product_variant_id' => $variant?->id, 'external_product_id' => $product->wc_product_id ? (string) $product->wc_product_id : $product->shopify_product_id, 'external_variant_id' => $variant?->wc_variant_id ? (string) $variant->wc_variant_id : $variant?->shopify_variant_id, 'product_name' => $product->name, 'variant_name' => $variant?->name, 'quantity' => $qty, 'unit_price' => $unitPrice->getAmount(), 'total' => $unitPrice->multiply($qty)->getAmount()];
        }

        return $prepared;
    }

    private function replaceOnlineOrderItems(OnlineOrder $order, array $prepared): void
    {
        $order->items()->delete();
        foreach ($prepared as $item) {
            OnlineOrderItem::create([
                'user_id' => $order->user_id, 'online_order_id' => $order->id,
                'product_id' => $item['product_id'], 'product_variant_id' => $item['product_variant_id'],
                'external_product_id' => $item['external_product_id'] ?? null,
                'external_variant_id' => $item['external_variant_id'] ?? null,
                'quantity' => $item['quantity'],
            ]);
        }
    }

    private function recalculateOrderTotalsAndNote(User $user, OnlineOrder $order, array $prepared, ?string $notes): void
    {
        $sub = array_reduce($prepared, fn (Money $c, $i) => $c->add(Money::of($i['total'])), Money::zero());
        $rawTotal = $sub->subtract(Money::of($order->discount_total ?? 0))->add(Money::of($order->tax_total ?? 0))->add(Money::of($order->shipping_cost ?? 0));
        $total = $rawTotal->isNegative() ? Money::zero() : $rawTotal;
        $snapshot = array_map(fn ($i) => ['name' => $i['product_name'] . ($i['variant_name'] ? " - {$i['variant_name']}" : ''), 'product_id' => $i['product_id'], 'product_variant_id' => $i['product_variant_id'], 'quantity' => $i['quantity'], 'price' => $i['unit_price'], 'total' => $i['total']], $prepared);
        $tag = "[تبديل مقاس/صنف قبل الشحن بواسطة {$user->name}" . ($notes ? ": {$notes}" : '') . ']';

        $order->update([
            'subtotal' => $sub->getAmount(), 'total' => $total->getAmount(),
            'items_snapshot' => $snapshot, 'notes' => $order->notes ? "{$order->notes}\n{$tag}" : $tag,
        ]);
    }

    private function calculatePostDeliveryPlan(array $returned, array $replacement, array $data): array
    {
        $retTotal = array_reduce($returned, fn (Money $c, $i) => $c->add(Money::of($i['total'])), Money::zero());
        $repTotal = array_reduce($replacement, fn (Money $c, $i) => $c->add(Money::of($i['total'])), Money::zero());
        $shipFee = Money::of($data['exchange_shipping_fee'] ?? 0);
        $creditUse = Money::of($data['store_credit_used'] ?? 0);
        $pref = ExchangeSettlementType::tryFrom((string) ($data['surplus_settlement'] ?? ExchangeSettlementType::STORE_CREDIT->value))
            ?? ExchangeSettlementType::STORE_CREDIT;

        return $this->calculator->calculate($retTotal, $repTotal, $shipFee, $creditUse, $pref);
    }

    private function assertWalletPartyPresent(OnlineOrder $order, array $plan): void
    {
        if (($plan['store_credit_earned']->isPositive() || $plan['store_credit_used']->isPositive()) && !$order->party_id) {
            throw new PosDomainException('يجب ربط الطلب بملف عميل مسجل لإيداع أو استخدام رصيد المحفظة، أو اختر رد الفائض عبر التحويل اليدوي.', 'CUSTOMER_REQUIRED_FOR_STORE_CREDIT', 422);
        }
    }

    private function persistPendingOnlineExchange(User $user, OnlineOrder $order, Invoice $originalInvoice, array $plan, array $data): Exchange
    {
        $seq = $this->sequenceService->next($user->getAccountId(), DocumentType::EXCHANGE);
        $number = 'EXC-' . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
        $method = $plan['settlement_type'] === ExchangeSettlementType::REFUND_CASH
            ? (string) ($data['refund_method'] ?? PaymentMethod::INSTAPAY->value)
            : ($plan['settlement_type'] === ExchangeSettlementType::STORE_CREDIT ? PaymentMethod::STORE_CREDIT->value : PaymentMethod::EXCHANGE_OFFSET->value);

        return Exchange::create([
            'user_id' => $user->getAccountId(), 'branch_id' => $order->branch_id, 'created_by' => $user->id,
            'salesperson_id' => $originalInvoice->salesperson_id, 'exchange_number' => $number,
            'source' => ExchangeSource::ONLINE_ORDER, 'status' => ExchangeStatus::AWAITING_COURIER_PICKUP,
            'party_id' => $order->party_id, 'original_invoice_id' => $originalInvoice->id,
            'original_online_order_id' => $order->id, 'return_total' => $plan['return_total']->getAmount(),
            'replacement_total' => $plan['replacement_total']->getAmount(), 'exchange_shipping_fee' => $plan['shipping_fee']->getAmount(),
            'store_credit_used' => $plan['store_credit_used']->getAmount(), 'net_amount' => $plan['signed_net_amount']->getAmount(),
            'settlement_type' => $plan['settlement_type'], 'payment_method' => $method, 'notes' => $data['notes'] ?? null,
        ]);
    }

    private function resolveOnlineRefundChannel(Exchange $exchange): string
    {
        if ($exchange->settlement_type === ExchangeSettlementType::REFUND_CASH && $exchange->payment_method) {
            return $exchange->payment_method instanceof \BackedEnum ? $exchange->payment_method->value : (string) $exchange->payment_method;
        }

        return PaymentMethod::STORE_CREDIT->value;
    }

    private function createReplacementOnlineOrder(OnlineOrder $original, Exchange $exchange, array $replacement, array $plan, array $data): OnlineOrder
    {
        $codDue = $plan['net_customer_due'];
        $snapshot = array_map(fn ($i) => ['name' => $i['product_name'] . ($i['variant_name'] ? " - {$i['variant_name']}" : ''), 'product_id' => $i['product_id'], 'product_variant_id' => $i['product_variant_id'], 'quantity' => $i['quantity'], 'price' => $i['unit_price'], 'total' => $i['total']], $replacement);

        $newOrder = OnlineOrder::create([
            'user_id' => $original->user_id, 'platform' => $original->platform,
            'external_order_id' => $exchange->exchange_number, 'external_order_number' => $exchange->exchange_number,
            'order_date' => now(), 'party_id' => $original->party_id, 'branch_id' => $original->branch_id,
            'status' => WcOrderStatus::CONFIRMED, 'is_exchange' => true, 'exchange_id' => $exchange->id,
            'payment_status' => $codDue->isPositive() ? WcPaymentStatus::PENDING_COD : WcPaymentStatus::PAID_ONLINE,
            'payment_method_label' => $codDue->isPositive() ? 'استبدال COD (فرق + شحن)' : 'استبدال (بدون تحصيل)',
            'shipping_cost' => $plan['shipping_fee']->getAmount(), 'subtotal' => $plan['replacement_total']->getAmount(),
            'discount_total' => 0, 'tax_total' => 0, 'total' => $codDue->getAmount(),
            'customer_name' => $original->customer_name, 'customer_phone' => $original->customer_phone,
            'customer_email' => $original->customer_email, 'customer_address' => $original->customer_address,
            'governorate' => $original->governorate, 'city' => $original->city,
            'items_snapshot' => $snapshot,
            'notes' => trim("شحنة استبدال {$exchange->exchange_number} للأوردر {$original->displayReference()} — تسليم البديل واستلام المرتجع. " . ($data['notes'] ?? '')),
        ]);
        $this->replaceOnlineOrderItems($newOrder, $replacement);

        return $newOrder;
    }

    private function rebuildPlanFromExchange(Exchange $exchange): array
    {
        return $this->calculator->calculate(
            Money::of($exchange->return_total),
            Money::of($exchange->replacement_total),
            Money::of($exchange->exchange_shipping_fee),
            Money::of($exchange->store_credit_used),
            $exchange->settlement_type instanceof ExchangeSettlementType ? $exchange->settlement_type : ExchangeSettlementType::STORE_CREDIT
        );
    }

    private function resolveDeliveredCollection(OnlineOrder $order, Money $netDue, array $deliveryData): array
    {
        if (!$netDue->isPositive()) {
            return [PaymentMethod::EXCHANGE_OFFSET->value, Money::zero()];
        }
        $collected = Money::of($deliveryData['collected_amount'] ?? $netDue->getAmount());
        $method = (string) ($deliveryData['payment_method'] ?? ($order->courier_party_id ? PaymentMethod::COURIER_COD->value : PaymentMethod::CASH->value));

        return [$method, $collected];
    }

    private function mapExchangeItemsForInvoice($items): array
    {
        return $items->map(fn (ExchangeItem $i) => [
            'product_id' => $i->product_id, 'product_variant_id' => $i->product_variant_id,
            'quantity' => $i->quantity, 'unit_price' => $i->unit_price,
            'is_damaged' => $i->condition === ReturnItemCondition::DAMAGED,
        ])->values()->all();
    }

    private function buildOnlineSaleExtras(OnlineOrder $order, ?int $branchId, string $method): array
    {
        $extras = ['online_order_id' => $order->id, 'branch_id' => $branchId, 'courier_party_id' => $order->courier_party_id];
        if ($order->mandob && $method === PaymentMethod::CASH->value) {
            $extras['created_by'] = $order->mandob->id;
            $extras['treasury_id'] = $order->mandob->assignedTreasury?->id;
            $extras['shift_id'] = $this->shiftService->getActiveShift($order->mandob)?->id;
        }

        return $extras;
    }

    private function finalizeCompletedOnlineExchange(User $user, Exchange $exchange, OnlineOrder $replacementOrder, Invoice $replacementInvoice, Invoice $returnInvoice, array $plan, Money $collected): void
    {
        if ($replacementOrder->courier_party_id && $collected->isPositive()) {
            $this->courierService->recordDeliveryCollection($user, $replacementInvoice, $replacementOrder, $collected->getAmount());
        }
        if ($plan['store_credit_earned']->isPositive() && $exchange->party) {
            $this->storeCreditService->earnFromExchange($user, $exchange->party, $plan['store_credit_earned'], $exchange);
        }
        $exchange->items()->where('direction', ExchangeItemDirection::RETURNED->value)->where('condition', ReturnItemCondition::SELLABLE->value)->update(['received_into_stock_at' => now()]);
        $exchange->update(['status' => ExchangeStatus::COMPLETED, 'return_invoice_id' => $returnInvoice->id, 'replacement_invoice_id' => $replacementInvoice->id, 'payment_method' => $replacementInvoice->payment_method, 'completed_at' => now()]);
        $replacementOrder->update(['invoice_id' => $replacementInvoice->id, 'status' => WcOrderStatus::DELIVERED, 'payment_status' => WcPaymentStatus::COLLECTED]);
    }
}
