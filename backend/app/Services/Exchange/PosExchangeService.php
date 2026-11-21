<?php

namespace App\Services\Exchange;

use App\Enums\DocumentType;
use App\Enums\ExchangeItemDirection;
use App\Enums\ExchangeSettlementType;
use App\Enums\ExchangeSource;
use App\Enums\ExchangeStatus;
use App\Enums\InvoiceType;
use App\Enums\PaymentMethod;
use App\Enums\ReturnItemCondition;
use App\Exceptions\PosDomainException;
use App\Models\Exchange;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Party;
use App\Models\Product;
use App\Models\User;
use App\Services\BranchScopeService;
use App\Services\DocumentSequenceService;
use App\Services\InvoiceService;
use App\Support\Money;
use App\Support\Quantity;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

class PosExchangeService
{
    public function __construct(
        private readonly InvoiceService $invoiceService,
        private readonly StoreCreditService $storeCreditService,
        private readonly ExchangeSettlementCalculator $calculator,
        private readonly ExchangeSalespersonGuard $salespersonGuard,
        private readonly DocumentSequenceService $sequenceService,
        private readonly BranchScopeService $branchScopeService,
    ) {}

    public function execute(User $user, array $data): Exchange
    {
        if (!empty($data['idempotency_key'])) {
            $existing = Exchange::where('user_id', $user->getAccountId())
                ->where('idempotency_key', $data['idempotency_key'])
                ->first();
            if ($existing) {
                return $existing->load(['items', 'party', 'returnInvoice', 'replacementInvoice', 'originalInvoice', 'salesperson']);
            }
        }

        return DB::transaction(fn () => $this->executeInsideTransaction($user, $data));
    }

    private function executeInsideTransaction(User $user, array $data): Exchange
    {
        $accountId = $user->getAccountId();
        $originalInvoice = $this->lockAndAuthorizeOriginalInvoice($user, $accountId, $data['original_invoice_id'] ?? null);
        $branchId = $this->resolveExchangeBranchId($user, $originalInvoice, $data['branch_id'] ?? null);
        $party = $this->resolveParty($accountId, $data['party_id'] ?? null, $originalInvoice?->party_id);
        $salespersons = $this->salespersonGuard->resolveForPosExchange($user, $originalInvoice, isset($data['replacement_salesperson_id']) ? (int) $data['replacement_salesperson_id'] : null);
        $returnedItems = $this->prepareReturnedItems($accountId, $originalInvoice, $data['returned_items']);
        $replacementItems = $this->prepareReplacementItems($accountId, $data['replacement_items'] ?? []);
        $plan = $this->computeSettlementPlan($returnedItems, $replacementItems, $data, $party);
        $this->assertPartyRequired($party, $plan, $data);

        $exchange = $this->createExchangeHeader($user, $accountId, $branchId, $party, $originalInvoice, $salespersons, $plan, $data);
        $returnInv = $this->createReturnInvoice($user, $exchange, $originalInvoice, $returnedItems, $plan, $salespersons['return_salesperson_id'], $data);
        $repInv = !empty($replacementItems) ? $this->createReplacementInvoice($user, $exchange, $replacementItems, $plan, $salespersons['replacement_salesperson_id'], $data) : null;
        $this->finalizeExchangeCreditAndItems($user, $exchange, $party, $plan, $returnedItems, $replacementItems, $data);
        $exchange->update(['return_invoice_id' => $returnInv->id, 'replacement_invoice_id' => $repInv?->id]);

        return $exchange->fresh(['items', 'party', 'returnInvoice.items', 'replacementInvoice.items', 'originalInvoice', 'salesperson', 'creator']);
    }

    private function lockAndAuthorizeOriginalInvoice(User $user, int $accountId, mixed $originalInvoiceId): ?Invoice
    {
        if (empty($originalInvoiceId)) {
            return null;
        }
        $invoice = Invoice::where('user_id', $accountId)->with('items')->lockForUpdate()->findOrFail((int) $originalInvoiceId);
        Gate::forUser($user)->authorize('viewForReturn', $invoice);
        $typeVal = $invoice->type instanceof InvoiceType ? $invoice->type->value : (string) $invoice->type;
        if ($typeVal !== InvoiceType::SALE->value) {
            throw new PosDomainException('يمكن تنفيذ الاستبدال على فواتير البيع فقط.', 'INVALID_ORIGINAL_INVOICE_TYPE', 422);
        }

        return $invoice;
    }

    private function resolveExchangeBranchId(User $user, ?Invoice $originalInvoice, mixed $requestedBranchId): ?int
    {
        $branchId = $originalInvoice?->branch_id
            ?? (!empty($requestedBranchId) ? (int) $requestedBranchId : ($user->branch_id ? (int) $user->branch_id : null));
        if ($branchId !== null) {
            $this->branchScopeService->assertCanAccessBranch($user, $branchId, 'عذراً، لا تملك صلاحية تنفيذ استبدال على فرع آخر.');
        }

        return $branchId;
    }

    private function resolveParty(int $accountId, mixed $requestedPartyId, ?int $originalPartyId): ?Party
    {
        $partyId = !empty($requestedPartyId) ? (int) $requestedPartyId : $originalPartyId;

        return $partyId ? Party::where('user_id', $accountId)->findOrFail($partyId) : null;
    }

    private function prepareReturnedItems(int $accountId, ?Invoice $originalInvoice, array $rows): array
    {
        $prepared = [];
        foreach ($rows as $row) {
            $product = Product::where('user_id', $accountId)->findOrFail((int) $row['product_id']);
            $variantId = !empty($row['product_variant_id']) ? (int) $row['product_variant_id'] : null;
            $variant = $variantId ? $product->variants()->findOrFail($variantId) : null;
            $qty = Quantity::of($row['quantity'])->toFloat();
            $unitPrice = $this->resolveReturnedUnitPrice($originalInvoice, $product, $variant?->id, $row['unit_price'] ?? null);
            $condition = ReturnItemCondition::tryFrom((string) ($row['condition'] ?? ReturnItemCondition::SELLABLE->value))
                ?? ReturnItemCondition::SELLABLE;

            $prepared[] = [
                'product_id' => $product->id,
                'product_variant_id' => $variant?->id,
                'product_batch_id' => !empty($row['product_batch_id']) ? (int) $row['product_batch_id'] : null,
                'product_name' => $product->name,
                'variant_name' => $variant?->name,
                'quantity' => $qty,
                'unit_price' => $unitPrice->getAmount(),
                'total' => $unitPrice->multiply($qty)->getAmount(),
                'condition' => $condition,
                'is_damaged' => $condition === ReturnItemCondition::DAMAGED,
            ];
        }

        return $prepared;
    }

    private function resolveReturnedUnitPrice(?Invoice $originalInvoice, Product $product, ?int $variantId, mixed $manualPrice): Money
    {
        if ($originalInvoice) {
            $matched = $originalInvoice->items->first(fn (InvoiceItem $i) => (int) $i->product_id === (int) $product->id
                && (int) ($i->product_variant_id ?? 0) === (int) ($variantId ?? 0));
            if (!$matched) {
                throw new PosDomainException("الصنف '{$product->name}' غير موجود في الفاتورة الأصلية المحددة.", 'RETURN_ITEM_NOT_IN_PARENT', 422);
            }
            return $this->prorateDiscountedUnitPrice($originalInvoice, $matched);
        }

        return Money::of($manualPrice ?? $product->selling_price ?? 0);
    }

    private function prorateDiscountedUnitPrice(Invoice $invoice, InvoiceItem $item): Money
    {
        $sub = Money::of($invoice->subtotal ?? 0);
        $disc = Money::of($invoice->discount ?? 0);
        $unit = Money::of($item->unit_price ?? 0);
        if (!$disc->isPositive() || !$sub->isPositive()) {
            return $unit;
        }
        $ratio = max(0, $sub->subtract($disc)->getAmount() / $sub->getAmount());

        return $unit->multiply($ratio);
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

            $prepared[] = [
                'product_id' => $product->id,
                'product_variant_id' => $variant?->id,
                'product_batch_id' => !empty($row['product_batch_id']) ? (int) $row['product_batch_id'] : null,
                'product_name' => $product->name,
                'variant_name' => $variant?->name,
                'quantity' => $qty,
                'unit_price' => $unitPrice->getAmount(),
                'total' => $unitPrice->multiply($qty)->getAmount(),
            ];
        }

        return $prepared;
    }

    private function computeSettlementPlan(array $returnedItems, array $replacementItems, array $data, ?Party $party): array
    {
        $returnTotal = array_reduce($returnedItems, fn (Money $c, $i) => $c->add(Money::of($i['total'])), Money::zero());
        $replacementTotal = array_reduce($replacementItems, fn (Money $c, $i) => $c->add(Money::of($i['total'])), Money::zero());
        $shippingFee = Money::of($data['exchange_shipping_fee'] ?? 0);
        $creditRequested = Money::of($data['store_credit_used'] ?? 0);
        if ($creditRequested->isPositive() && !$party) {
            throw new PosDomainException('يجب تحديد عميل مسجل لاستخدام رصيد المحفظة.', 'CUSTOMER_REQUIRED_FOR_STORE_CREDIT', 422);
        }

        $pref = ExchangeSettlementType::tryFrom((string) ($data['surplus_settlement'] ?? ExchangeSettlementType::STORE_CREDIT->value))
            ?? ExchangeSettlementType::STORE_CREDIT;

        return $this->calculator->calculate($returnTotal, $replacementTotal, $shippingFee, $creditRequested, $pref);
    }

    private function assertPartyRequired(?Party $party, array $plan, array $data): void
    {
        $method = (string) ($data['payment_method'] ?? PaymentMethod::CASH->value);
        $needsParty = $plan['store_credit_earned']->isPositive()
            || $plan['store_credit_used']->isPositive()
            || ($plan['net_customer_due']->isPositive() && $method === PaymentMethod::CREDIT->value);

        if ($needsParty && !$party) {
            throw new PosDomainException('يجب تحديد عميل مسجل للتعامل مع محفظة المتجر أو البيع الآجل.', 'CUSTOMER_REQUIRED', 422);
        }
    }

    private function createExchangeHeader(
        User $user,
        int $accountId,
        ?int $branchId,
        ?Party $party,
        ?Invoice $originalInvoice,
        array $salespersons,
        array $plan,
        array $data
    ): Exchange {
        $seq = $this->sequenceService->next($accountId, DocumentType::EXCHANGE);
        $number = 'EXC-' . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);

        return Exchange::create([
            'user_id' => $accountId, 'branch_id' => $branchId, 'created_by' => $user->id,
            'salesperson_id' => $salespersons['replacement_salesperson_id'] ?? $salespersons['return_salesperson_id'],
            'exchange_number' => $number, 'idempotency_key' => $data['idempotency_key'] ?? null,
            'source' => ExchangeSource::POS, 'status' => ExchangeStatus::COMPLETED,
            'party_id' => $party?->id, 'original_invoice_id' => $originalInvoice?->id,
            'return_total' => $plan['return_total']->getAmount(),
            'replacement_total' => $plan['replacement_total']->getAmount(),
            'exchange_shipping_fee' => $plan['shipping_fee']->getAmount(),
            'store_credit_used' => $plan['store_credit_used']->getAmount(),
            'net_amount' => $plan['signed_net_amount']->getAmount(),
            'settlement_type' => $plan['settlement_type'],
            'payment_method' => $this->resolveRecordedMethod($plan, $data),
            'completed_at' => now(), 'notes' => $data['notes'] ?? null,
        ]);
    }

    private function resolveRecordedMethod(array $plan, array $data): string
    {
        return match ($plan['settlement_type']) {
            ExchangeSettlementType::EVEN_EXCHANGE => PaymentMethod::EXCHANGE_OFFSET->value,
            ExchangeSettlementType::STORE_CREDIT => PaymentMethod::STORE_CREDIT->value,
            default => (string) ($data['payment_method'] ?? PaymentMethod::CASH->value),
        };
    }

    private function createReturnInvoice(
        User $user,
        Exchange $exchange,
        ?Invoice $originalInvoice,
        array $returnedItems,
        array $plan,
        ?int $salespersonId,
        array $data
    ): Invoice {
        $splits = $this->buildReturnSplits($plan, (string) ($data['refund_method'] ?? $data['payment_method'] ?? PaymentMethod::CASH->value));

        return $this->invoiceService->createInvoice($user, [
            '_internal_exchange' => true, '_forced_salesperson_id' => $salespersonId,
            'exchange_id' => $exchange->id, 'type' => InvoiceType::SALE_RETURN->value,
            'branch_id' => $exchange->branch_id, 'party_id' => $exchange->party_id,
            'parent_invoice_id' => $originalInvoice?->id, 'date' => $data['date'] ?? now()->toDateString(),
            'payment_method' => count($splits) > 1 ? PaymentMethod::SPLIT->value : $splits[0]['method'],
            'paid_amount' => $plan['return_total']->getAmount(),
            'split_payments' => count($splits) > 1 ? $splits : null,
            'items' => $returnedItems,
            'notes' => trim("مرتجع ضمن استبدال {$exchange->exchange_number} " . ($data['notes'] ?? '')),
        ]);
    }

    private function buildReturnSplits(array $plan, string $refundMethod): array
    {
        $splits = [];
        if ($plan['exchange_offset']->isPositive()) {
            $splits[] = ['method' => PaymentMethod::EXCHANGE_OFFSET->value, 'amount' => $plan['exchange_offset']->getAmount(), 'notes' => 'مقاصة استبدال'];
        }
        if ($plan['net_refund']->isPositive()) {
            $splits[] = ['method' => $refundMethod, 'amount' => $plan['net_refund']->getAmount(), 'notes' => 'رد فرق استبدال للعميل'];
        }
        if ($plan['store_credit_earned']->isPositive()) {
            $splits[] = ['method' => PaymentMethod::STORE_CREDIT->value, 'amount' => $plan['store_credit_earned']->getAmount(), 'notes' => 'ترحيل فائض الاستبدال لمحفظة العميل'];
        }

        return $splits ?: [['method' => PaymentMethod::EXCHANGE_OFFSET->value, 'amount' => $plan['return_total']->getAmount()]];
    }

    private function createReplacementInvoice(
        User $user,
        Exchange $exchange,
        array $replacementItems,
        array $plan,
        ?int $salespersonId,
        array $data
    ): Invoice {
        $splits = $this->buildReplacementSplits($plan, $data);
        $paidMoney = array_reduce($splits, fn (Money $c, $sp) => $c->add(Money::of($sp['amount'])), Money::zero());
        $isPureCreditDiff = ($data['payment_method'] ?? PaymentMethod::CASH->value) === PaymentMethod::CREDIT->value && empty($splits);

        return $this->invoiceService->createInvoice($user, [
            '_internal_exchange' => true, '_forced_salesperson_id' => $salespersonId,
            'exchange_id' => $exchange->id, 'type' => InvoiceType::SALE->value,
            'branch_id' => $exchange->branch_id, 'party_id' => $exchange->party_id,
            'date' => $data['date'] ?? now()->toDateString(),
            'shipping_amount' => $plan['shipping_fee']->getAmount(),
            'payment_method' => $isPureCreditDiff ? PaymentMethod::CREDIT->value : (count($splits) > 1 ? PaymentMethod::SPLIT->value : ($splits[0]['method'] ?? PaymentMethod::EXCHANGE_OFFSET->value)),
            'paid_amount' => $paidMoney->getAmount(),
            'split_payments' => count($splits) > 1 ? $splits : null,
            'items' => $replacementItems,
            'notes' => trim("بديل ضمن استبدال {$exchange->exchange_number} " . ($data['notes'] ?? '')),
        ]);
    }

    private function buildReplacementSplits(array $plan, array $data): array
    {
        $splits = [];
        if ($plan['exchange_offset']->isPositive()) {
            $splits[] = ['method' => PaymentMethod::EXCHANGE_OFFSET->value, 'amount' => $plan['exchange_offset']->getAmount(), 'notes' => 'مقاصة استبدال'];
        }
        if ($plan['store_credit_used']->isPositive()) {
            $splits[] = ['method' => PaymentMethod::STORE_CREDIT->value, 'amount' => $plan['store_credit_used']->getAmount(), 'notes' => 'خصم من رصيد محفظة العميل'];
        }
        $method = (string) ($data['payment_method'] ?? PaymentMethod::CASH->value);
        if ($plan['net_customer_due']->isPositive() && $method !== PaymentMethod::CREDIT->value) {
            $splits[] = ['method' => $method, 'amount' => $plan['net_customer_due']->getAmount(), 'notes' => 'تحصيل فرق الاستبدال'];
        }

        return $splits;
    }

    private function finalizeExchangeCreditAndItems(
        User $user,
        Exchange $exchange,
        ?Party $party,
        array $plan,
        array $returnedItems,
        array $replacementItems,
        array $data
    ): void {
        if ($plan['store_credit_earned']->isPositive() && $party) {
            $expiresAt = !empty($data['store_credit_expires_at']) ? Carbon::parse($data['store_credit_expires_at']) : null;
            $this->storeCreditService->earnFromExchange($user, $party, $plan['store_credit_earned'], $exchange, $expiresAt);
        }

        $this->persistExchangeItems($exchange, ExchangeItemDirection::RETURNED, $returnedItems);
        $this->persistExchangeItems($exchange, ExchangeItemDirection::REPLACEMENT, $replacementItems);
    }

    private function persistExchangeItems(Exchange $exchange, ExchangeItemDirection $direction, array $items): void
    {
        foreach ($items as $item) {
            $condition = $item['condition'] ?? null;
            $receivedAt = ($direction === ExchangeItemDirection::RETURNED && $condition === ReturnItemCondition::SELLABLE) ? now() : null;
            $exchange->items()->create([
                'user_id' => $exchange->user_id, 'direction' => $direction->value,
                'product_id' => $item['product_id'], 'product_variant_id' => $item['product_variant_id'],
                'product_batch_id' => $item['product_batch_id'] ?? null,
                'product_name' => $item['product_name'], 'variant_name' => $item['variant_name'] ?? null,
                'quantity' => $item['quantity'], 'unit_price' => $item['unit_price'],
                'total' => $item['total'], 'condition' => $condition?->value,
                'received_into_stock_at' => $receivedAt,
            ]);
        }
    }
}
