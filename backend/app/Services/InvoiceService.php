<?php

namespace App\Services;

use App\Enums\DocumentType;
use App\Enums\InvoiceType;
use App\Enums\LedgerSource;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentType;
use App\Enums\StockMovementType;
use App\Enums\TreasuryTransactionType;
use App\Enums\TreasuryType;
use App\Exceptions\PosDomainException;
use App\Exceptions\ShiftDomainException;
use App\Models\Branch;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Party;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\Treasury;
use App\Models\TreasuryTransaction;
use App\Models\User;
use App\Services\DocumentSequenceService;
use App\Support\Money;
use App\Support\Quantity;
use Exception;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

class InvoiceService
{
    private const MAX_NUMBERING_RETRIES = 5;

    public function __construct(
        protected StockService $stockService,
        protected LedgerService $ledgerService,
        protected ?TreasuryService $treasuryService = null,
        protected ?ShiftService $shiftService = null,
        protected ?SettingService $settingService = null,
        protected ?DocumentSequenceService $sequenceService = null,
        protected ?PromotionEngineService $promotionService = null
    ) {
        $this->treasuryService ??= app(TreasuryService::class);
        $this->shiftService ??= app(ShiftService::class);
        $this->settingService ??= app(SettingService::class);
        $this->sequenceService ??= app(DocumentSequenceService::class);
        $this->promotionService ??= app(PromotionEngineService::class);
    }

    /**
     * إنشاء فاتورة ومعالجة المخزون والحسابات والدفع في عملية واحدة ذرية (Database Transaction)
     * مع حماية ترقيم الفاتورة من سباقات التزامن عبر المعيد الفريد وإعادة المحاولة.
     */
    public function createInvoice(User $user, array $data): Invoice
    {
        $idempotencyKey = $data['idempotency_key'] ?? null;
        if (!empty($idempotencyKey)) {
            $existing = Invoice::where('user_id', $user->getAccountId())
                ->where('idempotency_key', $idempotencyKey)
                ->first();
            if ($existing) {
                return $existing->load(['items', 'party']);
            }
        }

        $attempts = 0;
        while (true) {
            try {
                return $this->doCreateInvoice($user, $data, $idempotencyKey);
            } catch (QueryException $e) {
                $isDuplicate = (int) ($e->errorInfo[1] ?? 0) === 1062
                    || str_contains(strtolower($e->getMessage()), 'unique constraint failed')
                    || str_contains(strtolower($e->getMessage()), 'duplicate entry');
                if (!$isDuplicate || ++$attempts >= self::MAX_NUMBERING_RETRIES) {
                    throw $e;
                }
            }
        }
    }

    private function doCreateInvoice(User $user, array $data, $idempotencyKey): Invoice
    {
        return DB::transaction(function () use ($user, $data, $idempotencyKey) {
            $type = $data['type'] ?? null;
            $docType = $this->resolveDocumentTypeAndAuthorize($user, $type);
            $invoiceNumber = $this->resolveInvoiceNumber($user, $docType, $data);
            [$preparedItems, $subtotalMoney] = $this->prepareInvoiceItems($user, $type, $data['items']);
            $parentInvoice = $this->validateAndLockParentReturn($user, $type, $data, $preparedItems);
            $branchId = $this->resolveInvoiceBranchId($user, $this->resolveCreatorUser($user, $data), $data);
            $totals = $this->calculateInvoiceTotals($user, $data, $subtotalMoney, $data['payment_method'] ?? PaymentMethod::CASH->value, $preparedItems, $branchId);
            $context = $this->resolveInvoiceExecutionContext($user, $type, $data);
            $invoice = $this->persistInvoiceHeader($user, $data, $invoiceNumber, $idempotencyKey, $totals, $context, $parentInvoice);

            $this->persistInvoiceItemsAndStock($user, $invoice, $type, $preparedItems, $context['branch_id']);
            $this->recordInvoicePartyAndCourierLedger($user, $invoice, $type, $totals, $data);
            $this->processInvoicePayments($user, $invoice, $type, $totals, $context, $data);

            if ($context['active_shift']) {
                $this->shiftService->syncShiftFinancials($context['active_shift']);
            }

            return $invoice->load(['items', 'party']);
        });
    }

    private function resolveDocumentTypeAndAuthorize(User $user, ?string $type): DocumentType
    {
        $docType = match ($type) {
            InvoiceType::SALE->value => DocumentType::SALE,
            InvoiceType::PURCHASE->value => DocumentType::PURCHASE,
            InvoiceType::SALE_RETURN->value => DocumentType::SALE_RETURN,
            InvoiceType::PURCHASE_RETURN->value => DocumentType::PURCHASE_RETURN,
            default => throw new PosDomainException("نوع الفاتورة '{$type}' غير صالح.", 'INVALID_INVOICE_TYPE'),
        };

        if (in_array($type, [InvoiceType::PURCHASE->value, InvoiceType::PURCHASE_RETURN->value], true) && !$user->isOwnerOrAdmin() && !$user->isManager()) {
            throw new PosDomainException('عذراً، صلاحية إنشاء فواتير المشتريات مقتصرة على المالك والإدارة ومديري الفروع فقط.', 'UNAUTHORIZED_INVOICE_TYPE', 403);
        }

        return $docType;
    }

    private function resolveInvoiceNumber(User $user, DocumentType $docType, array $data): string
    {
        if (!empty($data['invoice_number'])) {
            return (string) $data['invoice_number'];
        }

        $prefix = match ($docType) {
            DocumentType::SALE => 'INV-',
            DocumentType::PURCHASE => 'PUR-',
            DocumentType::SALE_RETURN => 'SRT-',
            DocumentType::PURCHASE_RETURN => 'PRT-',
        };

        return $prefix . str_pad((string) $this->sequenceService->next($user->getAccountId(), $docType), 5, '0', STR_PAD_LEFT);
    }

    private function prepareInvoiceItems(User $user, string $type, array $items): array
    {
        $subtotalMoney = Money::zero();
        $preparedItems = [];

        foreach ($items as $itemData) {
            [$prepared, $itemTotalMoney] = $this->prepareSingleInvoiceItem($user, $type, $itemData);
            $subtotalMoney = $subtotalMoney->add($itemTotalMoney);
            $preparedItems[] = $prepared;
        }

        return [$preparedItems, $subtotalMoney];
    }

    private function prepareSingleInvoiceItem(User $user, string $type, array $itemData): array
    {
        $product = Product::where('user_id', $user->getAccountId())->findOrFail($itemData['product_id']);
        $qty = Quantity::of($itemData['quantity'])->toFloat();
        $unitPriceMoney = Money::of($itemData['unit_price']);
        $itemTotalMoney = $unitPriceMoney->multiply($qty);
        $variant = !empty($itemData['product_variant_id']) ? $product->variants()->findOrFail($itemData['product_variant_id']) : null;
        $unitName = $itemData['unit_name'] ?? $product->unit;
        $stockDeductQty = $this->resolveItemStockQuantity($product, $unitName, $qty, $itemData['is_sub_unit'] ?? null);
        $batch = $this->resolveInvoiceItemBatch($product, $variant, $type, $stockDeductQty, $itemData['product_batch_id'] ?? null);
        $rawCost = ($type === InvoiceType::SALE->value || $type === InvoiceType::SALE_RETURN->value) ? ($batch?->purchase_price ?? $variant?->purchase_price ?? $product->purchase_price) : $itemData['unit_price'];

        return [[
            'product' => $product, 'variant' => $variant, 'batch' => $batch,
            'product_variant_id' => $variant?->id, 'product_batch_id' => $batch?->id,
            'product_name' => $product->name, 'product_code' => $variant?->code ?? $product->code,
            'variant_name' => $itemData['variant_name'] ?? $variant?->name,
            'batch_number' => $batch?->batch_number ?? ($itemData['batch_number'] ?? null),
            'expiry_date' => $batch?->expiry_date?->format('Y-m-d') ?? ($itemData['expiry_date'] ?? null),
            'unit_name' => $unitName, 'quantity' => $qty, 'stock_deduct_qty' => $stockDeductQty,
            'unit_price' => $unitPriceMoney->getAmount(), 'purchase_price_at_sale' => Money::of($rawCost ?? 0)->getAmount(),
            'total' => $itemTotalMoney->getAmount(), 'notes' => $itemData['notes'] ?? null,
        ], $itemTotalMoney];
    }

    private function resolveItemStockQuantity(Product $product, ?string $unitName, float $qty, ?bool $explicitIsSubUnit = null): float
    {
        $isSubUnit = ($explicitIsSubUnit ?? false) || ($product->sub_unit && $unitName === $product->sub_unit);
        $factor = Quantity::of($product->sub_unit_factor ?? 0);

        return ($isSubUnit && $factor->isPositive()) ? $qty * $factor->toFloat() : $qty;
    }

    private function resolveInvoiceItemBatch(Product $product, $variant, string $type, float $stockDeductQty, ?int $batchId)
    {
        if (!empty($batchId)) {
            return $product->batches()->find($batchId);
        }
        if (!$product->hasExpiry() || ($type !== InvoiceType::SALE->value && $type !== InvoiceType::PURCHASE_RETURN->value)) {
            return null;
        }

        $batchQuery = $product->batches()->where('quantity', '>', 0);
        if ($variant) {
            $batchQuery->where('product_variant_id', $variant->id);
        }

        return (clone $batchQuery)->where('quantity', '>=', $stockDeductQty)->orderBy('expiry_date', 'asc')->first()
            ?? $batchQuery->orderBy('expiry_date', 'asc')->first();
    }

    private function calculateInvoiceTotals(User $user, array $data, Money $subtotalMoney, string $paymentMethod, array $preparedItems = [], ?int $branchId = null): array
    {
        $promo = $this->resolveInvoicePromotion($user, $data, $preparedItems, $branchId);
        $promoDiscountMoney = $promo['promotion_discount_money']->isGreaterThan($subtotalMoney) ? $subtotalMoney : $promo['promotion_discount_money'];
        $discountMoney = $this->enforceDiscountLimits($user, $data, $subtotalMoney, Money::of($data['discount'] ?? 0), $promoDiscountMoney);
        $taxMoney = Money::of($data['tax'] ?? 0);
        $shippingMoney = Money::of($data['shipping_amount'] ?? 0);
        $totalMoney = $subtotalMoney->subtract($discountMoney)->add($taxMoney)->add($shippingMoney);
        $totalMoney = $totalMoney->isNegative() ? Money::zero() : $totalMoney;
        $paidAmountMoney = $this->resolveInvoicePaidMoney($data, $totalMoney, $paymentMethod);
        $remainingMoney = $totalMoney->subtract($paidAmountMoney);
        $remainingMoney = $remainingMoney->isNegative() ? Money::zero() : $remainingMoney;

        return [
            'payment_method' => $paymentMethod, 'subtotal' => $subtotalMoney->getAmount(),
            'discount' => $discountMoney->getAmount(), 'promotion_discount' => $promoDiscountMoney->getAmount(),
            'promotion_id' => $promo['promotion_id'], 'coupon_code' => $promo['coupon_code'],
            'tax' => $taxMoney->getAmount(), 'shipping_amount' => $shippingMoney->getAmount(),
            'total' => $totalMoney->getAmount(), 'paid_amount_money' => $paidAmountMoney,
            'paid_amount' => $paidAmountMoney->getAmount(), 'remaining_amount' => $remainingMoney->getAmount(),
        ];
    }

    private function resolveInvoicePromotion(User $user, array $data, array $preparedItems, ?int $branchId): array
    {
        $isExternal = !empty($data['online_order_id']) || !empty($data['wc_order_id']) || !empty($data['shopify_order_id']);
        if ($isExternal) {
            return ['promotion_id' => null, 'coupon_code' => $data['coupon_code'] ?? null, 'promotion_discount_money' => Money::of($data['promotion_discount'] ?? 0)];
        }
        $wantsPromo = ($data['type'] ?? null) === InvoiceType::SALE->value && (!empty($data['coupon_code']) || !empty($data['promotion_id']) || !empty($data['apply_auto_promotion']));
        if (!$wantsPromo) {
            return ['promotion_id' => null, 'coupon_code' => null, 'promotion_discount_money' => Money::zero()];
        }
        $couponCode = $data['coupon_code'] ?? ($data['promotion_id'] ? Promotion::where('user_id', $user->getAccountId())->whereKey((int) $data['promotion_id'])->value('code') : null);
        $eval = $this->promotionService->evaluateCart($user, $this->mapPreparedItemsForPromo($preparedItems), $couponCode, $branchId, !empty($couponCode));
        $this->consumeLockedPromotion($eval['promotion_id'], $user->getAccountId());

        return $eval;
    }

    private function mapPreparedItemsForPromo(array $preparedItems): array
    {
        return array_map(fn (array $item) => [
            'product_id' => $item['product']->id,
            'quantity' => $item['quantity'],
            'unit_price' => $item['unit_price'],
        ], $preparedItems);
    }

    private function consumeLockedPromotion(?int $promotionId, int $accountId): void
    {
        if (!$promotionId) {
            return;
        }
        $promo = Promotion::where('user_id', $accountId)->lockForUpdate()->find($promotionId);
        if ($promo && $promo->max_uses !== null && (int) $promo->used_count >= (int) $promo->max_uses) {
            throw new PosDomainException('تم استنفاد الحد الأقصى لاستخدام هذا العرض أو الكوبون.', 'PROMOTION_MAX_USES_EXCEEDED', 422);
        }
        $promo?->increment('used_count');
    }

    private function enforceDiscountLimits(User $user, array $data, Money $subtotalMoney, Money $discountMoney, Money $promoDiscountMoney): Money
    {
        if ($discountMoney->isLessThan($promoDiscountMoney)) {
            $discountMoney = $promoDiscountMoney;
        }
        if ($discountMoney->isGreaterThan($subtotalMoney)) {
            if (empty($data['online_order_id']) && empty($data['wc_order_id']) && empty($data['shopify_order_id'])) {
                throw new PosDomainException('قيمة الخصم لا يمكن أن تتجاوز إجمالي الأصناف (قيمة السلة).', 'DISCOUNT_EXCEEDS_SUBTOTAL', 422);
            }
            $discountMoney = $subtotalMoney;
        }
        $this->assertCashierManualDiscountLimit($user, $data, $subtotalMoney, $discountMoney->subtract($promoDiscountMoney));

        return $discountMoney;
    }

    private function assertCashierManualDiscountLimit(User $user, array $data, Money $subtotalMoney, Money $manualDiscountMoney): void
    {
        $maxPercent = $this->settingService->getMaxDiscountPercent($user);
        $isExternalStoreOrder = !empty($data['online_order_id']) || !empty($data['wc_order_id']) || !empty($data['shopify_order_id']);
        if (!$isExternalStoreOrder && !$user->isOwnerOrAdmin() && !$user->isManager() && $maxPercent < 100.0 && $manualDiscountMoney->isGreaterThan($subtotalMoney->multiply($maxPercent / 100.0))) {
            $maxAmount = number_format($subtotalMoney->multiply($maxPercent / 100.0)->getAmount(), 2);
            throw new PosDomainException(sprintf('أقصى نسبة خصم مسموحة لك هي %.2f%% (بحد أقصى %s).', $maxPercent, $maxAmount), 'DISCOUNT_EXCEEDS_LIMIT', 422);
        }
    }

    private function resolveInvoicePaidMoney(array $data, Money $totalMoney, string $paymentMethod): Money
    {
        $paidAmountMoney = Money::of($data['paid_amount'] ?? 0);
        if ($paymentMethod === PaymentMethod::SPLIT->value && !empty($data['split_payments'])) {
            $paidAmountMoney = array_reduce($data['split_payments'], fn (Money $c, $sp) => $c->add(Money::of($sp['amount'] ?? 0)), Money::zero());
        } elseif ($paymentMethod !== PaymentMethod::CREDIT->value && $paidAmountMoney->isZero() && !isset($data['paid_amount'])) {
            $paidAmountMoney = $totalMoney;
        }

        if ($paidAmountMoney->isGreaterThan($totalMoney)) {
            throw new PosDomainException("المبلغ المسدد ({$paidAmountMoney->getAmount()}) لا يمكن أن يتجاوز إجمالي الفاتورة ({$totalMoney->getAmount()}).", 'OVERPAYMENT_NOT_ALLOWED');
        }

        return $paidAmountMoney;
    }

    private function resolveCreatorUser(User $user, array $data): User
    {
        $createdBy = !empty($data['created_by']) ? (int) $data['created_by'] : $user->id;

        return ($createdBy === $user->id) ? $user : (\App\Models\User::find($createdBy) ?? $user);
    }

    private function resolveInvoiceExecutionContext(User $user, string $type, array $data): array
    {
        $accountId = $user->getAccountId();
        $creatorUser = $this->resolveCreatorUser($user, $data);
        $createdBy = $creatorUser->id;
        $activeShift = !empty($data['shift_id'])
            ? \App\Models\Shift::withoutGlobalScopes()->where('user_id', $accountId)->find($data['shift_id'])
            : $this->shiftService->getActiveShift($creatorUser);

        if (($type === InvoiceType::SALE->value || $type === InvoiceType::SALE_RETURN->value) && ($user->isCashier() || $user->isMandob()) && !$activeShift) {
            throw new ShiftDomainException('يجب فتح وردية أولاً قبل تسجيل أي عملية بيع أو مرتجع نقدي.', 'ACTIVE_SHIFT_REQUIRED');
        }

        $treasury = !empty($data['treasury_id'])
            ? (\App\Models\Treasury::withoutGlobalScopes()->where('user_id', $accountId)->find($data['treasury_id']) ?? $this->treasuryService->getTreasuryForUser($creatorUser))
            : $this->treasuryService->getTreasuryForUser($creatorUser);

        return [
            'created_by' => $createdBy, 'creator_user' => $creatorUser, 'active_shift' => $activeShift,
            'treasury' => $treasury, 'branch_id' => $this->resolveInvoiceBranchId($user, $creatorUser, $data),
        ];
    }

    private function resolveInvoiceBranchId(User $user, User $creatorUser, array $data): ?int
    {
        $accountId = $user->getAccountId();
        $branchId = !$user->isOwnerOrAdmin()
            ? ($user->branch_id ?? $creatorUser->branch_id)
            : (!empty($data['branch_id']) ? (int) $data['branch_id'] : $creatorUser->branch_id);

        if ($branchId && !Branch::where('user_id', $accountId)->where('id', $branchId)->exists()) {
            $branchId = null;
        }

        return $branchId ?? Branch::where('user_id', $accountId)->where('is_main', true)->value('id')
            ?? Branch::where('user_id', $accountId)->value('id');
    }

    private function persistInvoiceHeader(User $user, array $data, string $invoiceNumber, $idempotencyKey, array $totals, array $context, ?Invoice $parentInvoice = null): Invoice
    {
        $type = $data['type'];

        return Invoice::create([
            'user_id' => $user->getAccountId(), 'branch_id' => $context['branch_id'], 'created_by' => $context['created_by'],
            'salesperson_id' => $this->resolveInitialSalespersonId($data, $context, $parentInvoice, $type),
            'treasury_id' => $context['treasury']->id, 'shift_id' => $context['active_shift']?->id,
            'invoice_number' => $invoiceNumber, 'idempotency_key' => $idempotencyKey,
            'online_order_id' => $data['online_order_id'] ?? null,
            'wc_order_id' => $data['wc_order_id'] ?? null,
            'shopify_order_id' => $data['shopify_order_id'] ?? null,
            'type' => $type, 'party_id' => $data['party_id'] ?? null,
            'courier_party_id' => !empty($data['courier_party_id']) ? (int) $data['courier_party_id'] : null,
            'parent_invoice_id' => $data['parent_invoice_id'] ?? null, 'promotion_id' => $totals['promotion_id'] ?? null,
            'coupon_code' => $totals['coupon_code'] ?? null, 'date' => $data['date'] ?? now()->toDateString(),
            'subtotal' => $totals['subtotal'], 'discount' => $totals['discount'], 'promotion_discount' => $totals['promotion_discount'] ?? 0,
            'tax' => $totals['tax'],
            'shipping_amount' => $totals['shipping_amount'], 'total' => $totals['total'],
            'paid_amount' => $totals['paid_amount'], 'remaining_amount' => $totals['remaining_amount'],
            'payment_method' => $totals['payment_method'], 'notes' => $data['notes'] ?? null,
        ]);
    }

    private function resolveInitialSalespersonId(array $data, array $context, ?Invoice $parentInvoice, string $type): ?int
    {
        if (!in_array($type, [InvoiceType::SALE->value, InvoiceType::SALE_RETURN->value], true)) {
            return null;
        }
        if (!empty($data['salesperson_id'])) {
            return (int) $data['salesperson_id'];
        }
        if ($this->isEcommercePayload($data, $parentInvoice)) {
            return null;
        }

        return $parentInvoice?->salesperson_id ?? $parentInvoice?->created_by ?? $context['created_by'];
    }

    private function isEcommercePayload(array $data, ?Invoice $parentInvoice = null): bool
    {
        return !empty($data['online_order_id'])
            || !empty($data['wc_order_id'])
            || !empty($data['shopify_order_id'])
            || ($parentInvoice?->isEcommerceOrder() ?? false);
    }

    private function persistInvoiceItemsAndStock(User $user, Invoice $invoice, string $type, array $preparedItems, ?int $branchId): void
    {
        $movementType = match ($type) {
            InvoiceType::SALE->value, InvoiceType::PURCHASE_RETURN->value => StockMovementType::OUT->value,
            InvoiceType::PURCHASE->value, InvoiceType::SALE_RETURN->value => StockMovementType::IN->value,
        };

        foreach ($preparedItems as $item) {
            $invoice->items()->create([
                'product_id' => $item['product']->id, 'product_variant_id' => $item['product_variant_id'],
                'product_batch_id' => $item['product_batch_id'], 'product_name' => $item['product_name'],
                'product_code' => $item['product_code'], 'variant_name' => $item['variant_name'],
                'batch_number' => $item['batch_number'], 'expiry_date' => $item['expiry_date'],
                'unit_name' => $item['unit_name'], 'quantity' => $item['quantity'], 'unit_price' => $item['unit_price'],
                'purchase_price_at_sale' => $item['purchase_price_at_sale'], 'total' => $item['total'], 'notes' => $item['notes'],
            ]);
            $note = "فاتورة {$invoice->invoice_number}" . ($item['variant_name'] ? " ({$item['variant_name']})" : '');
            $this->stockService->recordMovement($user, $item['product'], $movementType, $type, $invoice->id, $item['stock_deduct_qty'], $item['unit_price'], $note, $item['variant'], $item['batch'], $branchId);
            $this->syncPurchaseItemCostPrice($type, $item);
        }
    }

    private function syncPurchaseItemCostPrice(string $type, array $item): void
    {
        if ($type !== InvoiceType::PURCHASE->value) {
            return;
        }
        $item['product']->update(['purchase_price' => $item['unit_price']]);
        if ($item['variant']) {
            $item['variant']->update(['purchase_price' => $item['unit_price']]);
        }
        if ($item['batch']) {
            $item['batch']->update(['purchase_price' => $item['unit_price']]);
        }
    }

    private function recordInvoicePartyAndCourierLedger(User $user, Invoice $invoice, string $type, array $totals, array $data): void
    {
        $partyId = $data['party_id'] ?? null;
        if ($partyId) {
            $party = Party::where('user_id', $user->getAccountId())->findOrFail($partyId);
            $this->recordInvoicePartyLedger($user, $party, $invoice, $type, $totals);
        }

        if (!empty($data['courier_party_id']) && $totals['shipping_amount'] > 0) {
            $courierParty = Party::where('user_id', $user->getAccountId())->where('type', PartyType::COURIER->value)->find($data['courier_party_id']);
            if ($courierParty) {
                $this->ledgerService->recordEntry($user, $courierParty, LedgerSource::INVOICE->value, $invoice->id, $invoice->date->format('Y-m-d'), "استحقاق أتعاب شحن وتوصيل - فاتورة {$invoice->invoice_number}", 0.0, $totals['shipping_amount']);
            }
        }
    }

    private function recordInvoicePartyLedger(User $user, Party $party, Invoice $invoice, string $type, array $totals): void
    {
        $isDebitInvoice = ($type === InvoiceType::SALE->value || $type === InvoiceType::PURCHASE_RETURN->value);
        $debit = $isDebitInvoice ? $totals['total'] : 0;
        $credit = $isDebitInvoice ? 0 : $totals['total'];
        $this->ledgerService->recordEntry($user, $party, LedgerSource::INVOICE->value, $invoice->id, $invoice->date->format('Y-m-d'), "فاتورة {$invoice->invoice_number}", $debit, $credit);

        if ($totals['paid_amount'] > 0) {
            $paymentType = $isDebitInvoice ? PaymentType::RECEIPT->value : PaymentType::PAYMENT->value;
            $payDebit = ($paymentType === PaymentType::PAYMENT->value) ? $totals['paid_amount'] : 0;
            $payCredit = ($paymentType === PaymentType::RECEIPT->value) ? $totals['paid_amount'] : 0;
            $this->ledgerService->recordEntry($user, $party, LedgerSource::PAYMENT->value, $invoice->id, $invoice->date->format('Y-m-d'), "سداد دفعة - {$invoice->invoice_number}", $payDebit, $payCredit);
        }
    }

    private function processInvoicePayments(User $user, Invoice $invoice, string $type, array $totals, array $context, array $data): void
    {
        if ($totals['paid_amount'] <= 0) {
            return;
        }
        $paymentType = ($type === InvoiceType::SALE->value || $type === InvoiceType::PURCHASE_RETURN->value) ? PaymentType::RECEIPT->value : PaymentType::PAYMENT->value;
        $partyId = $data['party_id'] ?? null;

        if ($totals['payment_method'] === PaymentMethod::SPLIT->value && !empty($data['split_payments'])) {
            $this->processSplitInvoicePayments($user, $invoice, $type, $paymentType, $partyId, $context, $data['split_payments']);
            return;
        }

        $this->recordChannelAllocation($user, $invoice, $type, $paymentType, $partyId, $context, $totals['paid_amount_money'], $totals['payment_method'], "سداد مرتبط بالفاتورة {$invoice->invoice_number}");
    }

    private function processSplitInvoicePayments(User $user, Invoice $invoice, string $type, string $paymentType, ?int $partyId, array $context, array $splitPayments): void
    {
        foreach ($splitPayments as $sp) {
            $spAmountMoney = Money::of($sp['amount'] ?? 0);
            if (!$spAmountMoney->isPositive()) {
                continue;
            }
            $spMethod = $sp['method'] ?? PaymentMethod::CASH->value;
            $spNotes = $sp['notes'] ?? "سداد مجزأ ({$spMethod}) - {$invoice->invoice_number}";
            $this->recordChannelAllocation($user, $invoice, $type, $paymentType, $partyId, $context, $spAmountMoney, $spMethod, $spNotes);
        }
    }

    private function recordChannelAllocation(User $user, Invoice $invoice, string $type, string $paymentType, ?int $partyId, array $context, Money $amount, string $method, string $notes): void
    {
        $targetTreasury = $this->resolveChannelTreasury($user, $method, $context);
        $this->persistInvoicePaymentRow($user, $invoice, $partyId, $context, $targetTreasury, $paymentType, $amount->getAmount(), $method, $notes);
        $this->applyInvoiceTreasuryImpact($user, $type, $method, $amount, $invoice, $context, $targetTreasury);
    }

    private function resolveChannelTreasury(User $user, string $method, array $context): Treasury
    {
        $electronicMethods = [PaymentMethod::CARD->value, PaymentMethod::INSTAPAY->value, PaymentMethod::VODAFONE_CASH->value, PaymentMethod::TRANSFER->value, TreasuryType::BANK->value, TreasuryType::WALLET->value];
        if (in_array($method, $electronicMethods, true)) {
            return $this->treasuryService->getTreasuryForPaymentMethod($user, $method);
        }

        return $context['treasury'];
    }

    private function persistInvoicePaymentRow(User $user, Invoice $invoice, ?int $partyId, array $context, Treasury $treasury, string $paymentType, float $amount, string $method, string $notes): void
    {
        Payment::create([
            'user_id' => $user->getAccountId(), 'created_by' => $context['created_by'], 'party_id' => $partyId,
            'invoice_id' => $invoice->id, 'treasury_id' => $treasury->id,
            'shift_id' => $context['active_shift']?->id, 'type' => $paymentType, 'amount' => $amount,
            'method' => $method, 'date' => $invoice->date->format('Y-m-d'), 'notes' => $notes,
        ]);
    }

    private function applyInvoiceTreasuryImpact(User $user, string $type, string $paymentMethod, Money $amount, Invoice $invoice, array $context, ?Treasury $targetTreasury = null): void
    {
        if (!$amount->isPositive()) {
            return;
        }
        $electronicMethods = [PaymentMethod::CARD->value, PaymentMethod::INSTAPAY->value, PaymentMethod::VODAFONE_CASH->value, PaymentMethod::TRANSFER->value, TreasuryType::BANK->value, TreasuryType::WALLET->value];

        if ($paymentMethod === PaymentMethod::CASH->value) {
            $note = $this->resolveCashTreasuryNote($type, $invoice->invoice_number);
            $this->recordInvoiceTreasuryMovement($user, $type, $targetTreasury ?? $context['treasury'], $amount, $invoice, $context['creator_user'], $context['active_shift']?->id, $note);
        } elseif (in_array($paymentMethod, $electronicMethods, true) && $type !== InvoiceType::PURCHASE_RETURN->value) {
            $treasury = $targetTreasury ?? $this->treasuryService->getTreasuryForPaymentMethod($user, $paymentMethod);
            $note = $this->resolveElectronicTreasuryNote($type, $paymentMethod, $invoice->invoice_number);
            $this->recordInvoiceTreasuryMovement($user, $type, $treasury, $amount, $invoice, $context['creator_user'], $context['active_shift']?->id, $note);
        }
    }

    private function recordInvoiceTreasuryMovement(User $user, string $type, $treasury, Money $amount, Invoice $invoice, User $creatorUser, ?int $shiftId, string $note): void
    {
        $isDeposit = ($type === InvoiceType::SALE->value || $type === InvoiceType::PURCHASE_RETURN->value);
        $actor = ($type === InvoiceType::SALE->value) ? $creatorUser : $user;

        if ($isDeposit) {
            $this->treasuryService->recordDeposit(treasury: $treasury, amount: $amount, sourceType: LedgerSource::INVOICE->value, sourceId: $invoice->id, actor: $actor, notes: $note, shiftId: $shiftId);
        } else {
            $this->treasuryService->recordWithdrawal(treasury: $treasury, amount: $amount, sourceType: LedgerSource::INVOICE->value, sourceId: $invoice->id, actor: $actor, notes: $note, shiftId: $shiftId);
        }
    }

    private function resolveCashTreasuryNote(string $type, string $invoiceNumber): string
    {
        return match ($type) {
            InvoiceType::SALE->value => "مبيعات نقدية فاتورة {$invoiceNumber}",
            InvoiceType::SALE_RETURN->value => "مرتجع مبيعات نقدي مسترد فاتورة {$invoiceNumber}",
            InvoiceType::PURCHASE->value => "سداد مشتريات نقداً فاتورة {$invoiceNumber}",
            InvoiceType::PURCHASE_RETURN->value => "استرداد مرتجع مشتريات نقدي فاتورة {$invoiceNumber}",
        };
    }

    private function resolveElectronicTreasuryNote(string $type, string $paymentMethod, string $invoiceNumber): string
    {
        return match ($type) {
            InvoiceType::SALE->value => "مبيعات إلكترونية ({$paymentMethod}) فاتورة {$invoiceNumber}",
            InvoiceType::SALE_RETURN->value => "مرتجع مبيعات مسترد ({$paymentMethod}) فاتورة {$invoiceNumber}",
            InvoiceType::PURCHASE->value => "سداد مشتريات ({$paymentMethod}) فاتورة {$invoiceNumber}",
        };
    }

    /**
     * الحذف الناعم للفاتورة مع عكس حركات المخزون والقيود المحاسبية
     */
    public function deleteInvoice(User $user, int $invoiceId): void
    {
        DB::transaction(function () use ($user, $invoiceId) {
            $invoice = Invoice::where('user_id', $user->getAccountId())
                ->with(['items.product', 'items.variant', 'items.batch'])
                ->findOrFail($invoiceId);
            $invoiceTypeStr = $invoice->type instanceof \BackedEnum ? $invoice->type->value : (string) $invoice->type;

            $this->reverseInvoiceStock($user, $invoice, $invoiceTypeStr);
            $this->reverseInvoiceFinancials($user, $invoice, $invoiceTypeStr);
            if ($invoice->promotion_id) {
                Promotion::where('user_id', $user->getAccountId())
                    ->whereKey($invoice->promotion_id)
                    ->where('used_count', '>', 0)
                    ->decrement('used_count');
            }
            $invoice->items()->delete();
            $invoice->delete();
        });
    }

    private function reverseInvoiceStock(User $user, Invoice $invoice, string $invoiceTypeStr): void
    {
        $movementType = match ($invoiceTypeStr) {
            InvoiceType::SALE->value, InvoiceType::PURCHASE_RETURN->value => StockMovementType::IN->value,
            InvoiceType::PURCHASE->value, InvoiceType::SALE_RETURN->value => StockMovementType::OUT->value,
        };
        foreach ($invoice->items as $item) {
            if (!$item->product) {
                continue;
            }
            $stockQty = $this->resolveItemStockQuantity($item->product, $item->unit_name, Quantity::of($item->quantity)->toFloat());
            $note = "إلغاء فاتورة {$invoice->invoice_number}" . ($item->variant_name ? " ({$item->variant_name})" : '');
            $this->stockService->recordMovement($user, $item->product, $movementType, LedgerSource::REVERSAL->value, $invoice->id, $stockQty, $item->unit_price, $note, $item->variant, $item->batch, $invoice->branch_id);
        }
    }

    private function reverseInvoiceFinancials(User $user, Invoice $invoice, string $invoiceTypeStr): void
    {
        if ($invoice->party_id) {
            $party = Party::where('user_id', $user->getAccountId())->findOrFail($invoice->party_id);
            $this->reversePartyLedgerForInvoice($user, $party, $invoice, $invoiceTypeStr);
        }
        $this->reverseTreasuryTransactionsForInvoice($user, $invoice);
        Payment::where('user_id', $user->getAccountId())->where('invoice_id', $invoice->id)->delete();
    }

    private function reversePartyLedgerForInvoice(User $user, Party $party, Invoice $invoice, string $invoiceTypeStr): void
    {
        $debit = in_array($invoiceTypeStr, [InvoiceType::SALE_RETURN->value, InvoiceType::PURCHASE->value], true) ? $invoice->total : 0;
        $credit = in_array($invoiceTypeStr, [InvoiceType::SALE->value, InvoiceType::PURCHASE_RETURN->value], true) ? $invoice->total : 0;
        $this->ledgerService->recordEntry($user, $party, LedgerSource::REVERSAL->value, $invoice->id, now()->toDateString(), "إلغاء فاتورة {$invoice->invoice_number}", $debit, $credit);

        if ($invoice->paid_amount > 0) {
            $isReceipt = ($invoiceTypeStr === InvoiceType::SALE->value || $invoiceTypeStr === InvoiceType::PURCHASE_RETURN->value);
            $this->ledgerService->recordEntry($user, $party, LedgerSource::REVERSAL->value, $invoice->id, now()->toDateString(), "إلغاء دفعة فاتورة {$invoice->invoice_number}", $isReceipt ? $invoice->paid_amount : 0, $isReceipt ? 0 : $invoice->paid_amount);
        }
    }

    private function reverseTreasuryTransactionsForInvoice(User $user, Invoice $invoice): void
    {
        $txns = TreasuryTransaction::where('user_id', $user->getAccountId())->where('source_type', LedgerSource::INVOICE->value)->where('source_id', $invoice->id)->get();
        foreach ($txns as $txn) {
            if (!$txn->treasury) {
                continue;
            }
            $txnMoney = Money::of($txn->amount);
            if ($txn->type === TreasuryTransactionType::DEPOSIT) {
                $this->treasuryService->recordWithdrawal($txn->treasury, $txnMoney, LedgerSource::REVERSAL->value, $invoice->id, $user, "إلغاء إيداع نقدي لفاتورة {$invoice->invoice_number}", $txn->shift_id);
            } elseif ($txn->type === TreasuryTransactionType::WITHDRAWAL) {
                $this->treasuryService->recordDeposit($txn->treasury, $txnMoney, LedgerSource::REVERSAL->value, $invoice->id, $user, "إلغاء صرف نقدي لفاتورة {$invoice->invoice_number}", $txn->shift_id);
            }
        }
    }

    /**
     * بناء استعلام الفواتير المفلتر بشكل مركزي موحد (DRY)
     */
    protected function buildFilteredInvoicesQuery(User $user, array $filters = []): \Illuminate\Database\Eloquent\Builder
    {
        $isEmployee = $user->isMandob() || $user->isCashier();
        $query = Invoice::query()
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when(!empty($filters['type']), fn($q) => $q->where('type', $filters['type']))
            ->when(!empty($filters['created_by']) && !$isEmployee, fn($q) => $q->where('created_by', $filters['created_by']))
            ->when(!empty($filters['date_from']), fn($q) => $q->where('date', '>=', $filters['date_from']))
            ->when(!empty($filters['date_to']), fn($q) => $q->where('date', '<=', $filters['date_to'] . ' 23:59:59'));

        app(BranchScopeService::class)->applyBranchFilter($query, $user, 'branch_id', !empty($filters['branch_id']) ? (int) $filters['branch_id'] : null);

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(fn($q) => $q->where('invoice_number', 'like', "%{$search}%")->orWhereHas('party', fn($pq) => $pq->where('name', 'like', "%{$search}%")));
        }

        return $query;
    }

    /**
     * استعلام قائمة الفواتير مع التصفية والبحث والصفحات
     */
    public function getInvoicesPaginated(User $user, array $filters = []): \Illuminate\Contracts\Pagination\LengthAwarePaginator
    {
        $perPage = min((int) ($filters['per_page'] ?? 20), 100);

        return $this->buildFilteredInvoicesQuery($user, $filters)
            ->with(['party', 'creator', 'salesperson', 'parentInvoice:id,invoice_number,online_order_id,wc_order_id,shopify_order_id'])
            ->withSum('returnInvoices as returned_total', 'total')
            ->withCount('returnInvoices as returns_count')
            ->latest()
            ->paginate($perPage);
    }

    /**
     * حساب إجمالي الفواتير للفترة المفلترة بدقة عبر كائن Money
     */
    public function getInvoicesSummary(User $user, array $filters = []): array
    {
        $query = $this->buildFilteredInvoicesQuery($user, $filters);

        return [
            'total_amount' => Money::of($query->sum('total') ?? 0)->getAmount(),
        ];
    }

    public function findOrFail(int $id): Invoice
    {
        return Invoice::findOrFail($id);
    }

    public function findForShowOrFail(int $id): Invoice
    {
        return Invoice::with(['party', 'items', 'creator', 'salesperson', 'parentInvoice:id,invoice_number,online_order_id,wc_order_id,shopify_order_id'])
            ->withSum('returnInvoices as returned_total', 'total')
            ->withCount('returnInvoices as returns_count')
            ->findOrFail($id);
    }

    public function findByNumberForUser(User $user, string $invoiceNumber, ?string $returnContextType = null): ?Invoice
    {
        $candidates = $this->buildInvoiceNumberCandidates($invoiceNumber, $returnContextType);
        if (empty($candidates)) {
            return null;
        }

        $matches = Invoice::where('user_id', $user->getAccountId())
            ->whereIn('invoice_number', $candidates)
            ->with(['party', 'items', 'creator', 'salesperson'])
            ->get()
            ->keyBy('invoice_number');

        foreach ($candidates as $candidate) {
            if ($matches->has($candidate)) {
                $found = $matches->get($candidate);
                $this->enrichItemsWithReturnableQuantities($user->getAccountId(), $found);

                return $found;
            }
        }

        return null;
    }

    private function validateAndLockParentReturn(User $user, string $type, array $data, array $preparedItems): ?Invoice
    {
        if (empty($data['parent_invoice_id']) || !in_array($type, [InvoiceType::SALE_RETURN->value, InvoiceType::PURCHASE_RETURN->value], true)) {
            return null;
        }
        $parent = Invoice::where('user_id', $user->getAccountId())->with('items')->lockForUpdate()->findOrFail((int) $data['parent_invoice_id']);
        $expectedParent = $type === InvoiceType::SALE_RETURN->value ? InvoiceType::SALE->value : InvoiceType::PURCHASE->value;
        $actualParent = $parent->type instanceof InvoiceType ? $parent->type->value : (string) $parent->type;
        if ($actualParent !== $expectedParent) {
            throw new PosDomainException('نوع الفاتورة الأصلية غير متوافق مع نوع المرتجع.', 'INVALID_PARENT_INVOICE_TYPE', 422);
        }
        $this->assertReturnQuantitiesWithinParent($user->getAccountId(), $parent, $preparedItems);

        return $parent;
    }

    private function assertReturnQuantitiesWithinParent(int $accountId, Invoice $parent, array $preparedItems): void
    {
        $originalMap = $this->aggregateItemQuantities($parent->items);
        $returnedMap = $this->getReturnedQuantitiesByParent($accountId, $parent->id);
        $requestedMap = $this->aggregateItemQuantities($preparedItems);

        foreach ($requestedMap as $key => $requestedQty) {
            if (!isset($originalMap[$key])) {
                throw new PosDomainException('أحد الأصناف المحددة غير موجود في الفاتورة الأصلية المربوطة.', 'RETURN_ITEM_NOT_IN_PARENT', 422);
            }
            $remaining = Quantity::of($originalMap[$key])->subtract(Quantity::of($returnedMap[$key] ?? 0))->maxZero();
            if ($requestedQty->isGreaterThan($remaining)) {
                throw new PosDomainException(
                    "الكمية المطلوب استرجاعها تتجاوز الكمية المتبقية القابلة للاسترجاع ({$remaining->toFloat()}).",
                    'RETURN_QUANTITY_EXCEEDS_ORIGINAL',
                    422
                );
            }
        }
    }

    /**
     * @return array<string, Quantity>
     */
    private function aggregateItemQuantities(iterable $items): array
    {
        $map = [];
        foreach ($items as $item) {
            $productId = is_array($item) ? (int) $item['product']->id : (int) $item->product_id;
            $variantId = is_array($item) ? ($item['product_variant_id'] ?? 0) : ($item->product_variant_id ?? 0);
            $qty = Quantity::of(is_array($item) ? $item['quantity'] : $item->quantity);
            $key = "{$productId}:{$variantId}";
            $map[$key] = isset($map[$key]) ? $map[$key]->add($qty) : $qty;
        }

        return $map;
    }

    /**
     * @return array<string, float>
     */
    private function getReturnedQuantitiesByParent(int $accountId, int $parentInvoiceId): array
    {
        $priorItems = InvoiceItem::whereHas('invoice', fn ($q) => $q->where('user_id', $accountId)->where('parent_invoice_id', $parentInvoiceId))
            ->get(['product_id', 'product_variant_id', 'quantity']);

        return array_map(fn (Quantity $q) => $q->toFloat(), $this->aggregateItemQuantities($priorItems));
    }

    private function enrichItemsWithReturnableQuantities(int $accountId, Invoice $invoice): void
    {
        $returnedMap = $this->getReturnedQuantitiesByParent($accountId, $invoice->id);
        foreach ($invoice->items as $item) {
            $key = "{$item->product_id}:" . ($item->product_variant_id ?? 0);
            $alreadyReturned = Quantity::of($returnedMap[$key] ?? 0);
            $returnable = Quantity::of($item->quantity)->subtract($alreadyReturned)->maxZero();
            $item->setAttribute('returned_quantity', $alreadyReturned->toFloat());
            $item->setAttribute('returnable_quantity', $returnable->toFloat());
            $item->setAttribute('effective_return_unit_price', $this->resolveEffectiveReturnUnitPrice($invoice, $item));
        }
    }

    private function resolveEffectiveReturnUnitPrice(Invoice $invoice, InvoiceItem $item): float
    {
        $subtotalMoney = Money::of($invoice->subtotal ?? 0);
        $discountMoney = Money::of($invoice->discount ?? 0);
        $unitPriceMoney = Money::of($item->unit_price ?? 0);
        if (!$discountMoney->isPositive() || !$subtotalMoney->isPositive()) {
            return $unitPriceMoney->getAmount();
        }
        $netRatio = max(0, $subtotalMoney->subtract($discountMoney)->getAmount() / $subtotalMoney->getAmount());

        return $unitPriceMoney->multiply($netRatio)->getAmount();
    }

    /**
     * @return array<int, string>
     */
    private function buildInvoiceNumberCandidates(string $rawInput, ?string $returnContextType): array
    {
        $cleaned = strtoupper(ltrim(trim($rawInput), '#'));
        if ($cleaned === '') {
            return [];
        }

        $candidates = [trim($rawInput), $cleaned];
        if (preg_match('/^(INV|PUR|SRT|PRT)-?0*(\d+)$/', $cleaned, $m)) {
            $num = (string) (int) $m[2];
            $candidates[] = $m[1] . '-' . str_pad($num, 5, '0', STR_PAD_LEFT);
            $candidates[] = $m[1] . '-' . $num;
        } elseif (preg_match('/^0*(\d+)$/', $cleaned, $m)) {
            $prefix = $returnContextType === InvoiceType::PURCHASE_RETURN->value ? 'PUR-' : 'INV-';
            $num = (string) (int) $m[1];
            $candidates[] = $prefix . str_pad($num, 5, '0', STR_PAD_LEFT);
            $candidates[] = $prefix . $num;
        }

        return array_values(array_unique(array_filter($candidates, fn (string $v) => $v !== '')));
    }

    public function updateSalesperson(Invoice $invoice, ?int $salespersonId): Invoice
    {
        $invoice->update(['salesperson_id' => $salespersonId]);

        return $invoice->fresh(['party', 'items', 'creator', 'salesperson']);
    }
}
