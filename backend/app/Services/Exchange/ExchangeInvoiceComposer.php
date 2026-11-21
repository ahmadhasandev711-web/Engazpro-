<?php

namespace App\Services\Exchange;

use App\Enums\ExchangeItemDirection;
use App\Enums\InvoiceType;
use App\Enums\PaymentMethod;
use App\Enums\ReturnItemCondition;
use App\Models\Exchange;
use App\Models\Invoice;
use App\Models\User;
use App\Services\InvoiceService;
use App\Support\Money;
use Carbon\Carbon;

class ExchangeInvoiceComposer
{
    public function __construct(
        private readonly InvoiceService $invoiceService
    ) {}

    public function createReturnInvoice(
        User $user,
        Exchange $exchange,
        ?Invoice $originalInvoice,
        array $returnedItems,
        array $plan,
        string $refundMethod,
        ?int $onlineOrderId = null,
        ?int $branchId = null,
        ?string $notes = null
    ): Invoice {
        $splits = $this->buildReturnSplits($plan, $refundMethod);

        return $this->invoiceService->createInvoice($user, [
            '_internal_exchange' => true,
            '_forced_salesperson_id' => $exchange->salesperson_id,
            'exchange_id' => $exchange->id,
            'online_order_id' => $onlineOrderId,
            'type' => InvoiceType::SALE_RETURN->value,
            'branch_id' => $branchId ?? $exchange->branch_id,
            'party_id' => $exchange->party_id,
            'parent_invoice_id' => $originalInvoice?->id,
            'date' => now()->toDateString(),
            'payment_method' => count($splits) > 1 ? PaymentMethod::SPLIT->value : $splits[0]['method'],
            'paid_amount' => $plan['return_total']->getAmount(),
            'split_payments' => count($splits) > 1 ? $splits : null,
            'items' => $returnedItems,
            'notes' => trim("مرتجع ضمن استبدال {$exchange->exchange_number} " . ($notes ?? '')),
        ]);
    }

    public function createReplacementInvoice(
        User $user,
        Exchange $exchange,
        array $replacementItems,
        array $plan,
        string $paymentMethod,
        Money $collectedCashOrCourier,
        array $extraPayload = []
    ): Invoice {
        $splits = $this->buildReplacementSplits($plan, $paymentMethod, $collectedCashOrCourier);
        $paidMoney = array_reduce($splits, fn (Money $c, $sp) => $c->add(Money::of($sp['amount'])), Money::zero());
        $resolvedMethod = $this->resolveReplacementMethod($paymentMethod, $splits);

        return $this->invoiceService->createInvoice($user, array_merge([
            '_internal_exchange' => true, '_forced_salesperson_id' => $exchange->salesperson_id,
            'exchange_id' => $exchange->id, 'type' => InvoiceType::SALE->value,
            'branch_id' => $exchange->branch_id, 'party_id' => $exchange->party_id,
            'date' => now()->toDateString(), 'shipping_amount' => $plan['shipping_fee']->getAmount(),
            'payment_method' => $resolvedMethod, 'paid_amount' => $paidMoney->getAmount(),
            'split_payments' => count($splits) > 1 ? $splits : null, 'items' => $replacementItems,
            'notes' => trim("بديل ضمن استبدال {$exchange->exchange_number} " . ($exchange->notes ?? '')),
        ], $extraPayload));
    }

    private function resolveReplacementMethod(string $paymentMethod, array $splits): string
    {
        if ($paymentMethod === PaymentMethod::CREDIT->value && empty($splits)) {
            return PaymentMethod::CREDIT->value;
        }

        return count($splits) > 1
            ? PaymentMethod::SPLIT->value
            : ($splits[0]['method'] ?? PaymentMethod::EXCHANGE_OFFSET->value);
    }

    public function persistExchangeItems(Exchange $exchange, ExchangeItemDirection $direction, array $items, ?Carbon $receivedAt = null): void
    {
        foreach ($items as $item) {
            $condition = $item['condition'] ?? null;
            $itemReceivedAt = ($direction === ExchangeItemDirection::RETURNED && $condition === ReturnItemCondition::SELLABLE) ? $receivedAt : null;
            $exchange->items()->create([
                'user_id' => $exchange->user_id, 'direction' => $direction->value,
                'product_id' => $item['product_id'], 'product_variant_id' => $item['product_variant_id'] ?? null,
                'product_batch_id' => $item['product_batch_id'] ?? null, 'product_name' => $item['product_name'],
                'variant_name' => $item['variant_name'] ?? null, 'quantity' => $item['quantity'],
                'unit_price' => $item['unit_price'], 'total' => $item['total'],
                'condition' => $condition instanceof ReturnItemCondition ? $condition->value : $condition,
                'received_into_stock_at' => $itemReceivedAt,
            ]);
        }
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

    private function buildReplacementSplits(array $plan, string $paymentMethod, Money $collectedAmount): array
    {
        $splits = [];
        if ($plan['exchange_offset']->isPositive()) {
            $splits[] = ['method' => PaymentMethod::EXCHANGE_OFFSET->value, 'amount' => $plan['exchange_offset']->getAmount(), 'notes' => 'مقاصة استبدال'];
        }
        if ($plan['store_credit_used']->isPositive()) {
            $splits[] = ['method' => PaymentMethod::STORE_CREDIT->value, 'amount' => $plan['store_credit_used']->getAmount(), 'notes' => 'خصم من رصيد محفظة العميل'];
        }
        if ($collectedAmount->isPositive() && $paymentMethod !== PaymentMethod::CREDIT->value) {
            $splits[] = ['method' => $paymentMethod, 'amount' => $collectedAmount->getAmount(), 'notes' => 'تحصيل فرق الاستبدال'];
        }

        return $splits;
    }
}
