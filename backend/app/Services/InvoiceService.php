<?php

namespace App\Services;

use App\Enums\PartyType;
use App\Models\Branch;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Party;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Support\Money;
use App\Models\TreasuryTransaction;
use App\Enums\TreasuryTransactionType;
use App\Exceptions\ShiftDomainException;
use App\Exceptions\PosDomainException;
use Exception;
use Illuminate\Support\Facades\DB;

class InvoiceService
{
    public function __construct(
        protected StockService $stockService,
        protected LedgerService $ledgerService,
        protected ?TreasuryService $treasuryService = null,
        protected ?ShiftService $shiftService = null
    ) {
        $this->treasuryService ??= app(TreasuryService::class);
        $this->shiftService ??= app(ShiftService::class);
    }

    /**
     * إنشاء فاتورة ومعالجة المخزون والحسابات والدفع في عملية واحدة ذرية (Database Transaction)
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

        return DB::transaction(function () use ($user, $data, $idempotencyKey) {
            $type = $data['type']; // SALE, PURCHASE, SALE_RETURN, PURCHASE_RETURN
            if (in_array($type, ['PURCHASE', 'PURCHASE_RETURN'], true) && !$user->isOwnerOrAdmin() && !$user->isManager()) {
                throw new PosDomainException('عذراً، صلاحية إنشاء فواتير المشتريات مقتصرة على المالك والإدارة ومديري الفروع فقط.', 'UNAUTHORIZED_INVOICE_TYPE', 403);
            }
            $items = $data['items'];
            $partyId = $data['party_id'] ?? null;
            $discount = (float) ($data['discount'] ?? 0);
            $tax = (float) ($data['tax'] ?? 0);
            $paymentMethod = $data['payment_method'] ?? 'CASH';
            $paidAmount = (float) ($data['paid_amount'] ?? 0);

            // توليد رقم الفاتورة
            $prefix = match ($type) {
                'SALE' => 'INV-',
                'PURCHASE' => 'PUR-',
                'SALE_RETURN' => 'SRT-',
                'PURCHASE_RETURN' => 'PRT-',
                default => 'DOC-',
            };
            $count = Invoice::where('user_id', $user->getAccountId())->where('type', $type)->count() + 1;
            $invoiceNumber = $data['invoice_number'] ?? ($prefix . str_pad($count, 5, '0', STR_PAD_LEFT));

            // حساب الإجماليات باستخدام كائن Money الموحد لمنع أخطاء التقريب
            $discountMoney = Money::of($data['discount'] ?? 0);
            $taxMoney = Money::of($data['tax'] ?? 0);
            $subtotalMoney = Money::zero();
            $preparedItems = [];

            foreach ($items as $itemData) {
                $product = Product::where('user_id', $user->getAccountId())->findOrFail($itemData['product_id']);
                $qty = (float) $itemData['quantity'];
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
                $stockFactor = ($isSubUnit && (float) $product->sub_unit_factor > 0) ? (float) $product->sub_unit_factor : 1.0;
                $stockDeductQty = $qty * $stockFactor;

                $batch = null;
                if (!empty($itemData['product_batch_id'])) {
                    $batch = $product->batches()->find($itemData['product_batch_id']);
                } elseif ($product->hasExpiry() && ($type === 'SALE' || $type === 'PURCHASE_RETURN')) {
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
                $rawCostPrice = ($type === 'SALE' || $type === 'SALE_RETURN')
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

            $shippingMoney = Money::of($data['shipping_amount'] ?? 0);
            $totalMoney = $subtotalMoney->subtract($discountMoney)->add($taxMoney)->add($shippingMoney);
            if ($totalMoney->isNegative()) {
                $totalMoney = Money::zero();
            }

            $paidAmountMoney = Money::of($data['paid_amount'] ?? 0);
            if ($paymentMethod === 'SPLIT' && !empty($data['split_payments'])) {
                $splitSumMoney = Money::zero();
                foreach ($data['split_payments'] as $sp) {
                    $splitSumMoney = $splitSumMoney->add(Money::of($sp['amount'] ?? 0));
                }
                $paidAmountMoney = $splitSumMoney;
            } elseif ($paymentMethod !== 'CREDIT' && $paidAmountMoney->isZero() && !isset($data['paid_amount'])) {
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

            if (($type === 'SALE' || $type === 'SALE_RETURN') && ($user->isCashier() || $user->isMandob())) {
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

            $isSaleType = in_array($type, ['SALE', 'SALE_RETURN'], true);
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
                    'SALE', 'PURCHASE_RETURN' => 'OUT',
                    'PURCHASE', 'SALE_RETURN' => 'IN',
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
                if ($type === 'PURCHASE') {
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
                    case 'SALE':
                        $debit = $total; // مدين بكامل الفاتورة
                        break;
                    case 'SALE_RETURN':
                        $credit = $total; // دائن بقيمة المرتجع
                        break;
                    case 'PURCHASE':
                        $credit = $total; // دائن بقيمة المشتريات
                        break;
                    case 'PURCHASE_RETURN':
                        $debit = $total; // مدين بقيمة مرتجع الشراء
                        break;
                }

                $this->ledgerService->recordEntry(
                    $user,
                    $party,
                    'INVOICE',
                    $invoice->id,
                    $invoice->date->format('Y-m-d'),
                    $desc,
                    $debit,
                    $credit
                );

                // قيد سداد في الـ Ledger إذا تم تحديد طرف
                if ($paidAmount > 0) {
                    $paymentType = ($type === 'SALE' || $type === 'PURCHASE_RETURN') ? 'RECEIPT' : 'PAYMENT';
                    $payDebit = ($paymentType === 'PAYMENT') ? $paidAmount : 0;
                    $payCredit = ($paymentType === 'RECEIPT') ? $paidAmount : 0;

                    $this->ledgerService->recordEntry(
                        $user,
                        $party,
                        'PAYMENT',
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
                        'INVOICE',
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
                $paymentType = ($type === 'SALE' || $type === 'PURCHASE_RETURN') ? 'RECEIPT' : 'PAYMENT';

                if ($paymentMethod === 'SPLIT' && !empty($data['split_payments'])) {
                    foreach ($data['split_payments'] as $sp) {
                        $spAmountMoney = Money::of($sp['amount'] ?? 0);
                        if (!$spAmountMoney->isPositive()) {
                            continue;
                        }

                        $spMethod = $sp['method'] ?? 'CASH';
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
                        if ($spMethod === 'CASH') {
                            if ($type === 'SALE') {
                                $this->treasuryService->recordDeposit(
                                    treasury: $treasury,
                                    amount: $spAmountMoney,
                                    sourceType: 'INVOICE',
                                    sourceId: $invoice->id,
                                    actor: $creatorUser,
                                    notes: "مبيعات نقدية (سداد مجزأ) فاتورة {$invoice->invoice_number}",
                                    shiftId: $activeShift?->id
                                );
                            } elseif ($type === 'SALE_RETURN') {
                                $this->treasuryService->recordWithdrawal(
                                    treasury: $treasury,
                                    amount: $spAmountMoney,
                                    sourceType: 'INVOICE',
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
                    if ($paymentMethod === 'CASH' && $paidAmountMoney->isPositive()) {
                        $paidMoney = $paidAmountMoney;
                        if ($type === 'SALE') {
                            $this->treasuryService->recordDeposit(
                                treasury: $treasury,
                                amount: $paidMoney,
                                sourceType: 'INVOICE',
                                sourceId: $invoice->id,
                                actor: $creatorUser,
                                notes: "مبيعات نقدية فاتورة {$invoice->invoice_number}",
                                shiftId: $activeShift?->id
                            );
                        } elseif ($type === 'SALE_RETURN') {
                            $this->treasuryService->recordWithdrawal(
                                treasury: $treasury,
                                amount: $paidMoney,
                                sourceType: 'INVOICE',
                                sourceId: $invoice->id,
                                actor: $user,
                                notes: "مرتجع مبيعات نقدي مسترد فاتورة {$invoice->invoice_number}",
                                shiftId: $activeShift?->id
                            );
                        } elseif ($type === 'PURCHASE') {
                            $this->treasuryService->recordWithdrawal(
                                treasury: $treasury,
                                amount: $paidMoney,
                                sourceType: 'INVOICE',
                                sourceId: $invoice->id,
                                actor: $user,
                                notes: "سداد مشتريات نقداً فاتورة {$invoice->invoice_number}",
                                shiftId: $activeShift?->id
                            );
                        } elseif ($type === 'PURCHASE_RETURN') {
                            $this->treasuryService->recordDeposit(
                                treasury: $treasury,
                                amount: $paidMoney,
                                sourceType: 'INVOICE',
                                sourceId: $invoice->id,
                                actor: $user,
                                notes: "استرداد مرتجع مشتريات نقدي فاتورة {$invoice->invoice_number}",
                                shiftId: $activeShift?->id
                            );
                        }
                    } elseif (in_array($paymentMethod, ['CARD', 'INSTAPAY', 'VODAFONE_CASH', 'TRANSFER', 'BANK', 'WALLET']) && $paidAmountMoney->isPositive()) {
                        $targetTreasury = $this->treasuryService->getTreasuryForPaymentMethod($user, $paymentMethod);
                        if ($type === 'SALE') {
                            $this->treasuryService->recordDeposit(
                                treasury: $targetTreasury,
                                amount: $paidAmountMoney,
                                sourceType: 'INVOICE',
                                sourceId: $invoice->id,
                                actor: $creatorUser,
                                notes: "مبيعات إلكترونية ({$paymentMethod}) فاتورة {$invoice->invoice_number}",
                                shiftId: $activeShift?->id
                            );
                        } elseif ($type === 'SALE_RETURN') {
                            $this->treasuryService->recordWithdrawal(
                                treasury: $targetTreasury,
                                amount: $paidAmountMoney,
                                sourceType: 'INVOICE',
                                sourceId: $invoice->id,
                                actor: $user,
                                notes: "مرتجع مبيعات مسترد ({$paymentMethod}) فاتورة {$invoice->invoice_number}",
                                shiftId: $activeShift?->id
                            );
                        } elseif ($type === 'PURCHASE') {
                            $this->treasuryService->recordWithdrawal(
                                treasury: $targetTreasury,
                                amount: $paidAmountMoney,
                                sourceType: 'INVOICE',
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
                    'SALE', 'PURCHASE_RETURN' => 'IN', // عكس הOUT
                    'PURCHASE', 'SALE_RETURN' => 'OUT', // عكس הIN
                };

                $this->stockService->recordMovement(
                    $user,
                    $item->product,
                    $movementType,
                    'REVERSAL',
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
                    case 'SALE':
                        $credit = $invoice->total; // نعكس المدين لدائن
                        break;
                    case 'SALE_RETURN':
                        $debit = $invoice->total; // نعكس الدائن لمدين
                        break;
                    case 'PURCHASE':
                        $debit = $invoice->total;
                        break;
                    case 'PURCHASE_RETURN':
                        $credit = $invoice->total;
                        break;
                }

                $this->ledgerService->recordEntry(
                    $user,
                    $party,
                    'REVERSAL',
                    $invoice->id,
                    now()->toDateString(),
                    "إلغاء فاتورة {$invoice->invoice_number}",
                    $debit,
                    $credit
                );

                // عكس قيد الدفع إن وجد
                if ($invoice->paid_amount > 0) {
                    $paymentType = ($invoiceTypeStr === 'SALE' || $invoiceTypeStr === 'PURCHASE_RETURN') ? 'RECEIPT' : 'PAYMENT';
                    $payDebit = ($paymentType === 'RECEIPT') ? $invoice->paid_amount : 0;
                    $payCredit = ($paymentType === 'PAYMENT') ? $invoice->paid_amount : 0;

                    $this->ledgerService->recordEntry(
                        $user,
                        $party,
                        'REVERSAL',
                        $invoice->id,
                        now()->toDateString(),
                        "إلغاء دفعة فاتورة {$invoice->invoice_number}",
                        $payDebit,
                        $payCredit
                    );
                }

                // عكس حركات الخزينة النقدية المرتبطة بالفاتورة لمنع تسريب أو تضخيم أرصدة الصناديق
                $treasuryTxns = TreasuryTransaction::where('user_id', $user->getAccountId())
                    ->where('source_type', 'INVOICE')
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
                                sourceType: 'REVERSAL',
                                sourceId: $invoice->id,
                                actor: $user,
                                notes: "إلغاء إيداع نقدي لفاتورة {$invoice->invoice_number}",
                                shiftId: $txn->shift_id
                            );
                        } elseif ($txn->type === TreasuryTransactionType::WITHDRAWAL) {
                            $this->treasuryService->recordDeposit(
                                treasury: $treasury,
                                amount: $txnMoney,
                                sourceType: 'REVERSAL',
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
            ->when(!empty($filters['branch_id']) && $user->isOwnerOrAdmin(), fn($q) => $q->where('branch_id', $filters['branch_id']));

        if (!empty($filters['type'])) {
            $query->where('type', $filters['type']);
        }

        if (!empty($filters['created_by']) && !$isEmployee) {
            $query->where('created_by', $filters['created_by']);
        }

        if (!empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                  ->orWhereHas('party', fn($pq) => $pq->where('name', 'like', "%{$search}%"));
            });
        }

        if (!empty($filters['date_from'])) {
            $query->where('date', '>=', $filters['date_from']);
        }
        if (!empty($filters['date_to'])) {
            $query->where('date', '<=', $filters['date_to'] . ' 23:59:59');
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
}
