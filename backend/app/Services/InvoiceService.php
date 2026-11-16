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
        protected ?DocumentSequenceService $sequenceService = null
    ) {
        $this->treasuryService ??= app(TreasuryService::class);
        $this->shiftService ??= app(ShiftService::class);
        $this->settingService ??= app(SettingService::class);
        $this->sequenceService ??= app(DocumentSequenceService::class);
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
            $type = $data['type'] ?? null; // SALE, PURCHASE, SALE_RETURN, PURCHASE_RETURN
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
            $items = $data['items'];
            $partyId = $data['party_id'] ?? null;
            $discount = Money::of($data['discount'] ?? 0)->getAmount();
            $tax = Money::of($data['tax'] ?? 0)->getAmount();
            $paymentMethod = $data['payment_method'] ?? PaymentMethod::CASH->value;
            $paidAmount = Money::of($data['paid_amount'] ?? 0)->getAmount();

            // توليد رقم الفاتورة
            $prefix = match ($docType) {
                DocumentType::SALE => 'INV-',
                DocumentType::PURCHASE => 'PUR-',
                DocumentType::SALE_RETURN => 'SRT-',
                DocumentType::PURCHASE_RETURN => 'PRT-',
            };
            if (!empty($data['invoice_number'])) {
                $invoiceNumber = (string) $data['invoice_number'];
            } else {
                $seq = $this->sequenceService->next($user->getAccountId(), $docType);
                $invoiceNumber = $prefix . str_pad((string) $seq, 5, '0', STR_PAD_LEFT);
            }

            // حساب الإجماليات باستخدام كائن Money الموحد لمنع أخطاء التقريب
            $discountMoney = Money::of($data['discount'] ?? 0);
            $taxMoney = Money::of($data['tax'] ?? 0);
            $subtotalMoney = Money::zero();
            $preparedItems = [];

            foreach ($items as $itemData) {
                $product = Product::where('user_id', $user->getAccountId())->findOrFail($itemData['product_id']);
                $qty = Quantity::of($itemData['quantity'])->toFloat();
                $unitPriceMoney = Money::of($itemData['unit_price']);
                $itemTotalMoney = $unitPriceMoney->multiply($qty);
                $subtotalMoney = $subtotalMoney->add($itemTotalMoney);

                $variant = null;
                if (!empty($itemData['product_variant_id'])) {
                    $variant = $product->variants()->findOrFail($itemData['product_variant_id']);
                }

                // دعم الوحدات المتعددة وتحويل الكمية للمخزون
                $unitName = $itemData['unit_name'] ?? $product->unit;
                $isSubUnit = ($itemData['is_sub_unit'] ?? false) || ($product->sub_unit && $unitName === $product->sub_unit);
                $stockFactor = ($isSubUnit && Quantity::of($product->sub_unit_factor ?? 0)->isPositive()) ? Quantity::of($product->sub_unit_factor)->toFloat() : 1.0;
                $stockDeductQty = $qty * $stockFactor;

                $batch = null;
                if (!empty($itemData['product_batch_id'])) {
                    $batch = $product->batches()->find($itemData['product_batch_id']);
                } elseif ($product->hasExpiry() && ($type === InvoiceType::SALE->value || $type === InvoiceType::PURCHASE_RETURN->value)) {
                    // FEFO: التخصيص التلقائي لأقرب تشغيلة منتهية الصلاحية بها رصيد كافٍ إن أمكن
                    $batchQuery = $product->batches()->where('quantity', '>', 0);
                    if ($variant) {
                        $batchQuery->where('product_variant_id', $variant->id);
                    }
                    $batch = (clone $batchQuery)->where('quantity', '>=', $stockDeductQty)
                        ->orderBy('expiry_date', 'asc')
                        ->first();

                    if (!$batch) {
                        $batch = $batchQuery->orderBy('expiry_date', 'asc')->first();
                    }
                }

                // حساب سعر الشراء بدقة لحساب الأرباح اللاحق
                $rawCostPrice = ($type === InvoiceType::SALE->value || $type === InvoiceType::SALE_RETURN->value)
                    ? ($batch?->purchase_price ?? $variant?->purchase_price ?? $product->purchase_price)
                    : $itemData['unit_price'];
                $purchasePriceAtSaleMoney = Money::of($rawCostPrice ?? 0);

                $preparedItems[] = [
                    'product' => $product,
                    'variant' => $variant,
                    'batch' => $batch,
                    'product_variant_id' => $variant?->id,
                    'product_batch_id' => $batch?->id,
                    'product_name' => $product->name,
                    'product_code' => $variant?->code ?? $product->code,
                    'variant_name' => $itemData['variant_name'] ?? $variant?->name,
                    'batch_number' => $batch?->batch_number ?? ($itemData['batch_number'] ?? null),
                    'expiry_date' => $batch?->expiry_date?->format('Y-m-d') ?? ($itemData['expiry_date'] ?? null),
                    'unit_name' => $unitName,
                    'quantity' => $qty,
                    'stock_deduct_qty' => $stockDeductQty,
                    'unit_price' => $unitPriceMoney->getAmount(),
                    'purchase_price_at_sale' => $purchasePriceAtSaleMoney->getAmount(),
                    'total' => $itemTotalMoney->getAmount(),
                    'notes' => $itemData['notes'] ?? null,
                ];
            }

            // سقف الخصم: لا يجوز أن يتجاوز إجمالي الأصناف (السلة)، مع تسامح يُفرض فقط على أوامر WooCommerce المتزامنة
            if ($discountMoney->isGreaterThan($subtotalMoney)) {
                if (!empty($data['wc_order_id'])) {
                    $discountMoney = $subtotalMoney;
                } else {
                    throw new PosDomainException(
                        'قيمة الخصم لا يمكن أن تتجاوز إجمالي الأصناف (قيمة السلة).',
                        'DISCOUNT_EXCEEDS_SUBTOTAL',
                        422
                    );
                }
            }

            // سقف النسبة المئوية للخصم على موظفي البيع (الكاشير/المندوب)، المالك والإدارة وادارة الفروع متجاوزون
            $maxDiscountPercent = $this->settingService->getMaxDiscountPercent($user);
            if (
                !$user->isOwnerOrAdmin() && !$user->isManager()
                && $maxDiscountPercent < 100.0
                && $discountMoney->isGreaterThan($subtotalMoney->multiply($maxDiscountPercent / 100.0))
            ) {
                throw new PosDomainException(
                    sprintf(
                        'أقصى نسبة خصم مسموحة لك هي %.2f%% (بحد أقصى %s).',
                        $maxDiscountPercent,
                        number_format($subtotalMoney->multiply($maxDiscountPercent / 100.0)->getAmount(), 2)
                    ),
                    'DISCOUNT_EXCEEDS_LIMIT',
                    422
                );
            }

            $shippingMoney = Money::of($data['shipping_amount'] ?? 0);
            $totalMoney = $subtotalMoney->subtract($discountMoney)->add($taxMoney)->add($shippingMoney);
            if ($totalMoney->isNegative()) {
                $totalMoney = Money::zero();
            }

            $paidAmountMoney = Money::of($data['paid_amount'] ?? 0);
            if ($paymentMethod === PaymentMethod::SPLIT->value && !empty($data['split_payments'])) {
                $splitSumMoney = Money::zero();
                foreach ($data['split_payments'] as $sp) {
                    $splitSumMoney = $splitSumMoney->add(Money::of($sp['amount'] ?? 0));
                }
                $paidAmountMoney = $splitSumMoney;
            } elseif ($paymentMethod !== PaymentMethod::CREDIT->value && $paidAmountMoney->isZero() && !isset($data['paid_amount'])) {
                $paidAmountMoney = $totalMoney;
            }

            if ($paidAmountMoney->isGreaterThan($totalMoney)) {
                throw new PosDomainException(
                    "المبلغ المسدد ({$paidAmountMoney->getAmount()}) لا يمكن أن يتجاوز إجمالي الفاتورة ({$totalMoney->getAmount()}).",
                    'OVERPAYMENT_NOT_ALLOWED'
                );
            }

            $remainingAmountMoney = $totalMoney->subtract($paidAmountMoney);
            if ($remainingAmountMoney->isNegative()) {
                $remainingAmountMoney = Money::zero();
            }

            $subtotal = $subtotalMoney->getAmount();
            $discount = $discountMoney->getAmount();
            $tax = $taxMoney->getAmount();
            $shippingAmount = $shippingMoney->getAmount();
            $total = $totalMoney->getAmount();
            $paidAmount = $paidAmountMoney->getAmount();
            $remainingAmount = $remainingAmountMoney->getAmount();

            // تحديد الخزينة والوردية النشطة والفرع المنفذ
            $createdBy = !empty($data['created_by']) ? (int) $data['created_by'] : $user->id;
            $creatorUser = ($createdBy === $user->id) ? $user : (\App\Models\User::find($createdBy) ?? $user);

            $activeShift = !empty($data['shift_id'])
                ? \App\Models\Shift::withoutGlobalScopes()->where('user_id', $user->getAccountId())->find($data['shift_id'])
                : $this->shiftService->getActiveShift($creatorUser);

            if (($type === InvoiceType::SALE->value || $type === InvoiceType::SALE_RETURN->value) && ($user->isCashier() || $user->isMandob())) {
                if (!$activeShift) {
                    throw new ShiftDomainException('يجب فتح وردية أولاً قبل تسجيل أي عملية بيع أو مرتجع نقدي.', 'ACTIVE_SHIFT_REQUIRED');
                }
            }

            $treasury = !empty($data['treasury_id'])
                ? (\App\Models\Treasury::withoutGlobalScopes()->where('user_id', $user->getAccountId())->find($data['treasury_id']) ?? $this->treasuryService->getTreasuryForUser($creatorUser))
                : $this->treasuryService->getTreasuryForUser($creatorUser);

            $branchId = !$user->isOwnerOrAdmin()
                ? ($user->branch_id ?? $creatorUser->branch_id)
                : (!empty($data['branch_id']) ? (int) $data['branch_id'] : $creatorUser->branch_id);
            if ($branchId) {
                $validBranch = Branch::where('user_id', $user->getAccountId())->where('id', $branchId)->exists();
                if (!$validBranch) {
                    $branchId = null;
                }
            }
            if (!$branchId) {
                $branchId = Branch::where('user_id', $user->getAccountId())->where('is_main', true)->value('id')
                    ?? Branch::where('user_id', $user->getAccountId())->value('id');
            }

            $isSaleType = in_array($type, [InvoiceType::SALE->value, InvoiceType::SALE_RETURN->value], true);
            $salespersonId = $isSaleType
                ? (!empty($data['salesperson_id']) ? (int) $data['salesperson_id'] : $createdBy)
                : null;

            // إنشاء الفاتورة
            $invoice = Invoice::create([
                'user_id' => $user->getAccountId(),
                'branch_id' => $branchId,
                'created_by' => $createdBy,
                'salesperson_id' => $salespersonId,
                'treasury_id' => $treasury->id,
                'shift_id' => $activeShift?->id,
                'invoice_number' => $invoiceNumber,
                'idempotency_key' => $idempotencyKey,
                'wc_order_id' => $data['wc_order_id'] ?? null,
                'type' => $type,
                'party_id' => $partyId,
                'courier_party_id' => !empty($data['courier_party_id']) ? (int) $data['courier_party_id'] : null,
                'parent_invoice_id' => $data['parent_invoice_id'] ?? null,
                'date' => $data['date'] ?? now()->toDateString(),
                'subtotal' => $subtotal,
                'discount' => $discount,
                'tax' => $tax,
                'shipping_amount' => $shippingAmount,
                'total' => $total,
                'paid_amount' => $paidAmount,
                'remaining_amount' => $remainingAmount,
                'payment_method' => $paymentMethod,
                'notes' => $data['notes'] ?? null,
            ]);

            // إضافة البنود وتسجيل حركة المخزون لكل بند
            foreach ($preparedItems as $item) {
                $invoice->items()->create([
                    'product_id' => $item['product']->id,
                    'product_variant_id' => $item['product_variant_id'],
                    'product_batch_id' => $item['product_batch_id'],
                    'product_name' => $item['product_name'],
                    'product_code' => $item['product_code'],
                    'variant_name' => $item['variant_name'],
                    'batch_number' => $item['batch_number'],
                    'expiry_date' => $item['expiry_date'],
                    'unit_name' => $item['unit_name'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'purchase_price_at_sale' => $item['purchase_price_at_sale'],
                    'total' => $item['total'],
                    'notes' => $item['notes'],
                ]);

                // تحديد اتجاه حركة المخزون
                // Sale: OUT, Purchase: IN, Sale Return: IN, Purchase Return: OUT
                $movementType = match ($type) {
                    InvoiceType::SALE->value, InvoiceType::PURCHASE_RETURN->value => StockMovementType::OUT->value,
                    InvoiceType::PURCHASE->value, InvoiceType::SALE_RETURN->value => StockMovementType::IN->value,
                };

                $this->stockService->recordMovement(
                    $user,
                    $item['product'],
                    $movementType,
                    $type,
                    $invoice->id,
                    $item['stock_deduct_qty'],
                    $item['unit_price'],
                    "فاتورة {$invoice->invoice_number}" . ($item['variant_name'] ? " ({$item['variant_name']})" : ''),
                    $item['variant'],
                    $item['batch'],
                    $branchId
                );

                // تحديث سعر الشراء المرجعي للمنتج والمتغير بدقة لضمان دقة حساب الأرباح في المبيعات اللاحقة
                if ($type === InvoiceType::PURCHASE->value) {
                    $item['product']->update(['purchase_price' => $item['unit_price']]);
                    if ($item['variant']) {
                        $item['variant']->update(['purchase_price' => $item['unit_price']]);
                    }
                    if ($item['batch']) {
                        $item['batch']->update(['purchase_price' => $item['unit_price']]);
                    }
                }
            }

            // التعامل مع حساب العميل أو المورد والـ Ledger
            $party = $partyId ? Party::where('user_id', $user->getAccountId())->findOrFail($partyId) : null;
            if ($party) {

                $desc = "فاتورة {$invoiceNumber}";
                $debit = 0;
                $credit = 0;

                switch ($type) {
                    case InvoiceType::SALE->value:
                        $debit = $total; // مدين بكامل الفاتورة
                        break;
                    case InvoiceType::SALE_RETURN->value:
                        $credit = $total; // دائن بقيمة المرتجع
                        break;
                    case InvoiceType::PURCHASE->value:
                        $credit = $total; // دائن بقيمة المشتريات
                        break;
                    case InvoiceType::PURCHASE_RETURN->value:
                        $debit = $total; // مدين بقيمة مرتجع الشراء
                        break;
                }

                $this->ledgerService->recordEntry(
                    $user,
                    $party,
                    LedgerSource::INVOICE->value,
                    $invoice->id,
                    $invoice->date->format('Y-m-d'),
                    $desc,
                    $debit,
                    $credit
                );

                // قيد سداد في الـ Ledger إذا تم تحديد طرف
                if ($paidAmount > 0) {
                    $paymentType = ($type === InvoiceType::SALE->value || $type === InvoiceType::PURCHASE_RETURN->value) ? PaymentType::RECEIPT->value : PaymentType::PAYMENT->value;
                    $payDebit = ($paymentType === PaymentType::PAYMENT->value) ? $paidAmount : 0;
                    $payCredit = ($paymentType === PaymentType::RECEIPT->value) ? $paidAmount : 0;

                    $this->ledgerService->recordEntry(
                        $user,
                        $party,
                        LedgerSource::PAYMENT->value,
                        $invoice->id,
                        $invoice->date->format('Y-m-d'),
                        "سداد دفعة - {$invoiceNumber}",
                        $payDebit,
                        $payCredit
                    );
                }
            }

            // تسجيل استحقاق أتعاب الشحن والتوصيل لصالح شركة الشحن (قيد دائن يثبت مستحقات الشركة)
            if (!empty($data['courier_party_id']) && $shippingAmount > 0) {
                $courierParty = Party::where('user_id', $user->getAccountId())
                    ->where('type', PartyType::COURIER->value)
                    ->find($data['courier_party_id']);

                if ($courierParty) {
                    $this->ledgerService->recordEntry(
                        $user,
                        $courierParty,
                        LedgerSource::INVOICE->value,
                        $invoice->id,
                        $invoice->date->format('Y-m-d'),
                        "استحقاق أتعاب شحن وتوصيل - فاتورة {$invoiceNumber}",
                        0.0,
                        $shippingAmount
                    );
                }
            }

            // إنشاء سجلات السداد في جدول Payments وتحديث حركات الخزينة
            if ($paidAmount > 0) {
                $paymentType = ($type === InvoiceType::SALE->value || $type === InvoiceType::PURCHASE_RETURN->value) ? PaymentType::RECEIPT->value : PaymentType::PAYMENT->value;

                if ($paymentMethod === PaymentMethod::SPLIT->value && !empty($data['split_payments'])) {
                    foreach ($data['split_payments'] as $sp) {
                        $spAmountMoney = Money::of($sp['amount'] ?? 0);
                        if (!$spAmountMoney->isPositive()) {
                            continue;
                        }

                        $spMethod = $sp['method'] ?? PaymentMethod::CASH->value;
                        $spNotes = $sp['notes'] ?? "سداد مجزأ ({$spMethod}) - {$invoiceNumber}";

                        Payment::create([
                            'user_id' => $user->getAccountId(),
                            'created_by' => $createdBy,
                            'party_id' => $party?->id,
                            'invoice_id' => $invoice->id,
                            'treasury_id' => $treasury->id,
                            'shift_id' => $activeShift?->id,
                            'type' => $paymentType,
                            'amount' => $spAmountMoney->getAmount(),
                            'method' => $spMethod,
                            'date' => $invoice->date->format('Y-m-d'),
                            'notes' => $spNotes,
                        ]);

                        // إذا كان الجزء المدفوع كاش، يتم إيداعه/سحبه من الخزينة
                        if ($spMethod === PaymentMethod::CASH->value) {
                            if ($type === InvoiceType::SALE->value) {
                                $this->treasuryService->recordDeposit(
                                    treasury: $treasury,
                                    amount: $spAmountMoney,
                                    sourceType: LedgerSource::INVOICE->value,
                                    sourceId: $invoice->id,
                                    actor: $creatorUser,
                                    notes: "مبيعات نقدية (سداد مجزأ) فاتورة {$invoice->invoice_number}",
                                    shiftId: $activeShift?->id
                                );
                            } elseif ($type === InvoiceType::SALE_RETURN->value) {
                                $this->treasuryService->recordWithdrawal(
                                    treasury: $treasury,
                                    amount: $spAmountMoney,
                                    sourceType: LedgerSource::INVOICE->value,
                                    sourceId: $invoice->id,
                                    actor: $user,
                                    notes: "مرتجع مبيعات نقدي (سداد مجزأ) فاتورة {$invoice->invoice_number}",
                                    shiftId: $activeShift?->id
                                );
                            }
                        }
                    }
                } else {
                    Payment::create([
                        'user_id' => $user->getAccountId(),
                        'created_by' => $createdBy,
                        'party_id' => $party?->id,
                        'invoice_id' => $invoice->id,
                        'treasury_id' => $treasury->id,
                        'shift_id' => $activeShift?->id,
                        'type' => $paymentType,
                        'amount' => $paidAmount,
                        'method' => $paymentMethod,
                        'date' => $invoice->date->format('Y-m-d'),
                        'notes' => "سداد مرتبط بالفاتورة {$invoiceNumber}",
                    ]);

                    // تسجيل حركة النقدية في الخزينة إذا كان السداد بالكامل نقداً
                    if ($paymentMethod === PaymentMethod::CASH->value && $paidAmountMoney->isPositive()) {
                        $paidMoney = $paidAmountMoney;
                        if ($type === InvoiceType::SALE->value) {
                            $this->treasuryService->recordDeposit(
                                treasury: $treasury,
                                amount: $paidMoney,
                                sourceType: LedgerSource::INVOICE->value,
                                sourceId: $invoice->id,
                                actor: $creatorUser,
                                notes: "مبيعات نقدية فاتورة {$invoice->invoice_number}",
                                shiftId: $activeShift?->id
                            );
                        } elseif ($type === InvoiceType::SALE_RETURN->value) {
                            $this->treasuryService->recordWithdrawal(
                                treasury: $treasury,
                                amount: $paidMoney,
                                sourceType: LedgerSource::INVOICE->value,
                                sourceId: $invoice->id,
                                actor: $user,
                                notes: "مرتجع مبيعات نقدي مسترد فاتورة {$invoice->invoice_number}",
                                shiftId: $activeShift?->id
                            );
                        } elseif ($type === InvoiceType::PURCHASE->value) {
                            $this->treasuryService->recordWithdrawal(
                                treasury: $treasury,
                                amount: $paidMoney,
                                sourceType: LedgerSource::INVOICE->value,
                                sourceId: $invoice->id,
                                actor: $user,
                                notes: "سداد مشتريات نقداً فاتورة {$invoice->invoice_number}",
                                shiftId: $activeShift?->id
                            );
                        } elseif ($type === InvoiceType::PURCHASE_RETURN->value) {
                            $this->treasuryService->recordDeposit(
                                treasury: $treasury,
                                amount: $paidMoney,
                                sourceType: LedgerSource::INVOICE->value,
                                sourceId: $invoice->id,
                                actor: $user,
                                notes: "استرداد مرتجع مشتريات نقدي فاتورة {$invoice->invoice_number}",
                                shiftId: $activeShift?->id
                            );
                        }
                    } elseif (in_array($paymentMethod, [PaymentMethod::CARD->value, PaymentMethod::INSTAPAY->value, PaymentMethod::VODAFONE_CASH->value, PaymentMethod::TRANSFER->value, TreasuryType::BANK->value, TreasuryType::WALLET->value]) && $paidAmountMoney->isPositive()) {
                        $targetTreasury = $this->treasuryService->getTreasuryForPaymentMethod($user, $paymentMethod);
                        if ($type === InvoiceType::SALE->value) {
                            $this->treasuryService->recordDeposit(
                                treasury: $targetTreasury,
                                amount: $paidAmountMoney,
                                sourceType: LedgerSource::INVOICE->value,
                                sourceId: $invoice->id,
                                actor: $creatorUser,
                                notes: "مبيعات إلكترونية ({$paymentMethod}) فاتورة {$invoice->invoice_number}",
                                shiftId: $activeShift?->id
                            );
                        } elseif ($type === InvoiceType::SALE_RETURN->value) {
                            $this->treasuryService->recordWithdrawal(
                                treasury: $targetTreasury,
                                amount: $paidAmountMoney,
                                sourceType: LedgerSource::INVOICE->value,
                                sourceId: $invoice->id,
                                actor: $user,
                                notes: "مرتجع مبيعات مسترد ({$paymentMethod}) فاتورة {$invoice->invoice_number}",
                                shiftId: $activeShift?->id
                            );
                        } elseif ($type === InvoiceType::PURCHASE->value) {
                            $this->treasuryService->recordWithdrawal(
                                treasury: $targetTreasury,
                                amount: $paidAmountMoney,
                                sourceType: LedgerSource::INVOICE->value,
                                sourceId: $invoice->id,
                                actor: $user,
                                notes: "سداد مشتريات ({$paymentMethod}) فاتورة {$invoice->invoice_number}",
                                shiftId: $activeShift?->id
                            );
                        }
                    }
                }
            }

            // تحديث الحسابات المالية الحية للوردية
            if ($activeShift) {
                $this->shiftService->syncShiftFinancials($activeShift);
            }

            return $invoice->load(['items', 'party']);
        });
    }

    /**
     * الحذف الناعم للفاتورة مع عكس حركات المخزون والقيود المحاسبية
     */
    public function deleteInvoice(User $user, int $invoiceId): void
    {
        DB::transaction(function () use ($user, $invoiceId) {
            $invoice = Invoice::where('user_id', $user->getAccountId())->findOrFail($invoiceId);
            $invoiceTypeStr = $invoice->type instanceof \BackedEnum ? $invoice->type->value : (string) $invoice->type;

            // 1. عكس حركات المخزون
            foreach ($invoice->items as $item) {
                // تحديد الاتجاه العكسي
                $movementType = match ($invoiceTypeStr) {
                    InvoiceType::SALE->value, InvoiceType::PURCHASE_RETURN->value => StockMovementType::IN->value, // عكس الOUT
                    InvoiceType::PURCHASE->value, InvoiceType::SALE_RETURN->value => StockMovementType::OUT->value, // عكس الIN
                };

                $this->stockService->recordMovement(
                    $user,
                    $item->product,
                    $movementType,
                    LedgerSource::REVERSAL->value,
                    $invoice->id,
                    $item->quantity,
                    $item->unit_price,
                    "إلغاء فاتورة {$invoice->invoice_number}"
                );
            }

            // 2. عكس حركات الحساب (Ledger) إن وجدت
            if ($invoice->party_id) {
                $party = Party::where('user_id', $user->getAccountId())->findOrFail($invoice->party_id);

                // عكس قيد الفاتورة
                $debit = 0;
                $credit = 0;
                switch ($invoiceTypeStr) {
                    case InvoiceType::SALE->value:
                        $credit = $invoice->total; // نعكس المدين لدائن
                        break;
                    case InvoiceType::SALE_RETURN->value:
                        $debit = $invoice->total; // نعكس الدائن لمدين
                        break;
                    case InvoiceType::PURCHASE->value:
                        $debit = $invoice->total;
                        break;
                    case InvoiceType::PURCHASE_RETURN->value:
                        $credit = $invoice->total;
                        break;
                }

                $this->ledgerService->recordEntry(
                    $user,
                    $party,
                    LedgerSource::REVERSAL->value,
                    $invoice->id,
                    now()->toDateString(),
                    "إلغاء فاتورة {$invoice->invoice_number}",
                    $debit,
                    $credit
                );

                // عكس قيد الدفع إن وجد
                if ($invoice->paid_amount > 0) {
                    $paymentType = ($invoiceTypeStr === InvoiceType::SALE->value || $invoiceTypeStr === InvoiceType::PURCHASE_RETURN->value) ? PaymentType::RECEIPT->value : PaymentType::PAYMENT->value;
                    $payDebit = ($paymentType === PaymentType::RECEIPT->value) ? $invoice->paid_amount : 0;
                    $payCredit = ($paymentType === PaymentType::PAYMENT->value) ? $invoice->paid_amount : 0;

                    $this->ledgerService->recordEntry(
                        $user,
                        $party,
                        LedgerSource::REVERSAL->value,
                        $invoice->id,
                        now()->toDateString(),
                        "إلغاء دفعة فاتورة {$invoice->invoice_number}",
                        $payDebit,
                        $payCredit
                    );
                }

                // عكس حركات الخزينة النقدية المرتبطة بالفاتورة لمنع تسريب أو تضخيم أرصدة الصناديق
                $treasuryTxns = TreasuryTransaction::where('user_id', $user->getAccountId())
                    ->where('source_type', LedgerSource::INVOICE->value)
                    ->where('source_id', $invoice->id)
                    ->get();

                foreach ($treasuryTxns as $txn) {
                    $treasury = $txn->treasury;
                    if ($treasury) {
                        $txnMoney = Money::of($txn->amount);
                        if ($txn->type === TreasuryTransactionType::DEPOSIT) {
                            $this->treasuryService->recordWithdrawal(
                                treasury: $treasury,
                                amount: $txnMoney,
                                sourceType: LedgerSource::REVERSAL->value,
                                sourceId: $invoice->id,
                                actor: $user,
                                notes: "إلغاء إيداع نقدي لفاتورة {$invoice->invoice_number}",
                                shiftId: $txn->shift_id
                            );
                        } elseif ($txn->type === TreasuryTransactionType::WITHDRAWAL) {
                            $this->treasuryService->recordDeposit(
                                treasury: $treasury,
                                amount: $txnMoney,
                                sourceType: LedgerSource::REVERSAL->value,
                                sourceId: $invoice->id,
                                actor: $user,
                                notes: "إلغاء صرف نقدي لفاتورة {$invoice->invoice_number}",
                                shiftId: $txn->shift_id
                            );
                        }
                    }
                }
                
                // حذف سندات الدفع المرتبطة
                Payment::where('user_id', $user->getAccountId())->where('invoice_id', $invoice->id)->delete();
            }

            // 3. حذف الفاتورة وعناصرها (Soft Delete)
            $invoice->items()->delete();
            $invoice->delete();
        });
    }

    /**
     * بناء استعلام الفواتير المفلتر بشكل مركزي موحد (DRY)
     */
    protected function buildFilteredInvoicesQuery(User $user, array $filters = []): \Illuminate\Database\Eloquent\Builder
    {
        $isEmployee = $user->isMandob() || $user->isCashier();
        $query = Invoice::query()
            ->when($isEmployee, fn($q) => $q->where('created_by', $user->id))
            ->when($user->isManager() && $user->branch_id, fn($q) => $q->where('branch_id', $user->branch_id))
            ->when(!empty($filters['branch_id']) && $user->isOwnerOrAdmin(), fn($q) => $q->where('branch_id', $filters['branch_id']))
            ->when(!empty($filters['type']), fn($q) => $q->where('type', $filters['type']))
            ->when(!empty($filters['created_by']) && !$isEmployee, fn($q) => $q->where('created_by', $filters['created_by']))
            ->when(!empty($filters['date_from']), fn($q) => $q->where('date', '>=', $filters['date_from']))
            ->when(!empty($filters['date_to']), fn($q) => $q->where('date', '<=', $filters['date_to'] . ' 23:59:59'));

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
            ->with(['party', 'creator', 'salesperson'])
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
        return Invoice::with(['party', 'items', 'creator', 'salesperson'])->findOrFail($id);
    }

    public function findByNumberForUser(User $user, string $invoiceNumber): ?Invoice
    {
        return Invoice::where('user_id', $user->getAccountId())
            ->where('invoice_number', $invoiceNumber)
            ->with(['party', 'items', 'creator', 'salesperson'])
            ->first();
    }

    public function updateSalesperson(Invoice $invoice, ?int $salespersonId): Invoice
    {
        $invoice->update(['salesperson_id' => $salespersonId]);

        return $invoice->fresh(['party', 'items', 'creator', 'salesperson']);
    }
}
