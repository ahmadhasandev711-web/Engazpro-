<?php

namespace App\Services;

use App\Enums\LedgerSource;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentType;
use App\Enums\StockTransferStatus;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Http\Resources\PartyResource;
use App\Models\Invoice;
use App\Models\LedgerEntry;
use App\Models\Party;
use App\Models\User;
use App\Models\WcOrder;
use App\Exceptions\PosDomainException;
use App\Models\Payment;
use App\Services\PaymentService;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

class CourierService
{
    public function __construct(
        protected LedgerService $ledgerService,
        protected PaymentService $paymentService
    ) {}

    /**
     * جلب قائمة شركات الشحن مع إحصائيات الطرود والتحصيلات والأرصدة
     */
    public function getCouriersWithMetrics(User $user, ?string $search = null): array
    {
        $accountId = $user->getAccountId();
        $couriers = Party::where('user_id', $accountId)
            ->where('type', PartyType::COURIER->value)
            ->withExists(['invoices', 'payments'])
            ->when(!empty($search), fn($q) => $q->where(fn($sq) => $sq->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%")->orWhere('notes', 'like', "%{$search}%")))
            ->orderBy('name')
            ->get();

        $courierIds = $couriers->pluck('id')->all();
        $wcStats = $this->fetchCourierWcStats($accountId, $courierIds);
        $invoiceStats = $this->fetchCourierDirectInvoiceStats($accountId, $courierIds);

        $couriersWithStats = $couriers->map(fn(Party $courier) => $this->buildCourierMetricRow($courier, $wcStats->get($courier->id), $invoiceStats->get($courier->id)));

        return [
            'couriers' => $couriersWithStats,
            'summary' => $this->buildCourierSummary($couriers->count(), $couriersWithStats),
        ];
    }

    private function fetchCourierWcStats(int $accountId, array $courierIds)
    {
        return WcOrder::where('user_id', $accountId)
            ->whereIn('courier_party_id', $courierIds)
            ->selectRaw('courier_party_id, COUNT(*) as total_orders_count, COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as active_orders_count, COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as delivered_orders_count, COALESCE(SUM(CASE WHEN status = ? AND payment_status != ? THEN total ELSE 0 END), 0) as pending_cod_amount', [
                WcOrderStatus::SHIPPED_VIA_COURIER->value,
                WcOrderStatus::DELIVERED->value,
                WcOrderStatus::SHIPPED_VIA_COURIER->value,
                WcPaymentStatus::PAID_ONLINE->value,
            ])
            ->groupBy('courier_party_id')
            ->get()
            ->keyBy('courier_party_id');
    }

    private function fetchCourierDirectInvoiceStats(int $accountId, array $courierIds)
    {
        return Invoice::where('user_id', $accountId)
            ->whereIn('courier_party_id', $courierIds)
            ->whereNull('wc_order_id')
            ->selectRaw('courier_party_id, COUNT(*) as total_invoices_count, COALESCE(SUM(CASE WHEN remaining_amount > 0 THEN 1 ELSE 0 END), 0) as active_invoices_count, COALESCE(SUM(remaining_amount), 0) as pending_direct_amount')
            ->groupBy('courier_party_id')
            ->get()
            ->keyBy('courier_party_id');
    }

    private function buildCourierMetricRow(Party $courier, ?object $wc, ?object $inv): array
    {
        $data = (new PartyResource($courier))->resolve();
        $data['active_shipments_count'] = (int) ($wc?->active_orders_count ?? 0) + (int) ($inv?->active_invoices_count ?? 0);
        $data['delivered_shipments_count'] = (int) ($wc?->delivered_orders_count ?? 0);
        $data['total_shipments_count'] = (int) ($wc?->total_orders_count ?? 0) + (int) ($inv?->total_invoices_count ?? 0);
        $data['pending_cod_amount'] = Money::of($wc?->pending_cod_amount ?? 0)->add(Money::of($inv?->pending_direct_amount ?? 0))->getAmount();

        return $data;
    }

    private function buildCourierSummary(int $totalCouriers, $couriersWithStats): array
    {
        $globalPendingCod = $couriersWithStats->reduce(fn(Money $c, $row) => $c->add(Money::of($row['pending_cod_amount'] ?? 0)), Money::zero())->getAmount();
        $globalNetBalance = $couriersWithStats->reduce(fn(Money $c, $row) => $c->add(Money::of($row['balance'] ?? 0)), Money::zero())->getAmount();

        return [
            'total_couriers' => $totalCouriers,
            'global_active_shipments' => (int) $couriersWithStats->sum('active_shipments_count'),
            'global_pending_cod' => $globalPendingCod,
            'global_net_balance' => $globalNetBalance,
        ];
    }

    /**
     * استخراج كشف الشحنات والبوالص التفصيلي لشركة الشحن (Manifest)
     */
    public function getCourierManifest(User $user, int $courierPartyId, ?int $branchId = null, array $filters = []): array
    {
        $accountId = $user->getAccountId();

        $courier = Party::where('user_id', $accountId)
            ->where('type', PartyType::COURIER->value)
            ->findOrFail($courierPartyId);

        $effectiveBranchId = null;
        if ($user->isManager() && $user->branch_id) {
            $effectiveBranchId = (int) $user->branch_id;
        } elseif ($branchId && $user->isOwnerOrAdmin()) {
            $effectiveBranchId = (int) $branchId;
        }

        // Base queries
        $wcBaseQuery = WcOrder::where('user_id', $accountId)
            ->where('courier_party_id', $courier->id)
            ->when($effectiveBranchId, fn ($q) => $q->where('branch_id', $effectiveBranchId));

        $invBaseQuery = Invoice::where('user_id', $accountId)
            ->where('courier_party_id', $courier->id)
            ->whereNull('wc_order_id')
            ->when($effectiveBranchId, fn ($q) => $q->where('branch_id', $effectiveBranchId));

        // الإجماليات الشاملة بـ SQL
        $wcMetrics = (clone $wcBaseQuery)->selectRaw('
            COUNT(*) as total_count,
            COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as in_transit_count,
            COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as delivered_count,
            COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as returned_count,
            COALESCE(SUM(total), 0) as total_amount,
            COALESCE(SUM(shipping_cost), 0) as total_shipping,
            COALESCE(SUM(CASE WHEN payment_status = ? THEN total ELSE 0 END), 0) as collected_amount,
            COALESCE(SUM(CASE WHEN status = ? AND payment_status != ? THEN total ELSE 0 END), 0) as pending_amount
        ', [
            WcOrderStatus::SHIPPED_VIA_COURIER->value,
            WcOrderStatus::DELIVERED->value,
            WcOrderStatus::RETURNED->value,
            WcPaymentStatus::COLLECTED->value,
            WcOrderStatus::SHIPPED_VIA_COURIER->value,
            WcPaymentStatus::PAID_ONLINE->value,
        ])->first();

        $invMetrics = (clone $invBaseQuery)->selectRaw('
            COUNT(*) as total_count,
            COALESCE(SUM(CASE WHEN remaining_amount > 0 THEN 1 ELSE 0 END), 0) as in_transit_count,
            COALESCE(SUM(CASE WHEN remaining_amount <= 0 THEN 1 ELSE 0 END), 0) as delivered_count,
            COALESCE(SUM(total), 0) as total_amount,
            COALESCE(SUM(shipping_amount), 0) as total_shipping,
            COALESCE(SUM(CASE WHEN remaining_amount <= 0 THEN total ELSE 0 END), 0) as collected_amount,
            COALESCE(SUM(CASE WHEN remaining_amount > 0 THEN total ELSE 0 END), 0) as pending_amount
        ')->first();

        $metrics = [
            'total_shipments' => (int) ($wcMetrics->total_count ?? 0) + (int) ($invMetrics->total_count ?? 0),
            'in_transit_count' => (int) ($wcMetrics->in_transit_count ?? 0) + (int) ($invMetrics->in_transit_count ?? 0),
            'delivered_count' => (int) ($wcMetrics->delivered_count ?? 0) + (int) ($invMetrics->delivered_count ?? 0),
            'returned_count' => (int) ($wcMetrics->returned_count ?? 0),
            'total_cod_amount' => Money::of($wcMetrics->total_amount ?? 0)->add(Money::of($invMetrics->total_amount ?? 0))->getAmount(),
            'total_shipping_fees' => Money::of($wcMetrics->total_shipping ?? 0)->add(Money::of($invMetrics->total_shipping ?? 0))->getAmount(),
            'collected_cod_amount' => Money::of($wcMetrics->collected_amount ?? 0)->add(Money::of($invMetrics->collected_amount ?? 0))->getAmount(),
            'pending_cod_amount' => Money::of($wcMetrics->pending_amount ?? 0)->add(Money::of($invMetrics->pending_amount ?? 0))->getAmount(),
        ];

        // تطبيق الفلاتر في قاعدة البيانات
        $statusFilter = $filters['status'] ?? 'ALL';
        $paymentFilter = $filters['payment_status'] ?? 'ALL';
        $sourceFilter = $filters['source'] ?? 'ALL';
        $search = trim((string) ($filters['search'] ?? ''));

        $wcFiltered = clone $wcBaseQuery;
        if ($statusFilter === StockTransferStatus::IN_TRANSIT->value) {
            $wcFiltered->where('status', WcOrderStatus::SHIPPED_VIA_COURIER->value);
        } elseif ($statusFilter === WcOrderStatus::DELIVERED->value) {
            $wcFiltered->where('status', WcOrderStatus::DELIVERED->value);
        } elseif ($statusFilter === WcOrderStatus::RETURNED->value) {
            $wcFiltered->where('status', WcOrderStatus::RETURNED->value);
        }

        if ($paymentFilter === 'COD') {
            $wcFiltered->where('payment_status', '!=', WcPaymentStatus::PAID_ONLINE->value);
        } elseif ($paymentFilter === 'PREPAID') {
            $wcFiltered->where('payment_status', WcPaymentStatus::PAID_ONLINE->value);
        }

        if ($search !== '') {
            $wcFiltered->where(function ($q) use ($search) {
                $q->where('wc_order_id', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_phone', 'like', "%{$search}%")
                    ->orWhere('tracking_number', 'like', "%{$search}%");
            });
        }

        $invFiltered = clone $invBaseQuery;
        if ($statusFilter === StockTransferStatus::IN_TRANSIT->value) {
            $invFiltered->where('remaining_amount', '>', 0);
        } elseif ($statusFilter === WcOrderStatus::DELIVERED->value) {
            $invFiltered->where('remaining_amount', '<=', 0);
        } elseif ($statusFilter === WcOrderStatus::RETURNED->value) {
            $invFiltered->whereRaw('0 = 1');
        }

        if ($paymentFilter === 'COD') {
            $invFiltered->where(function ($q) {
                $q->where('payment_method', \App\Enums\PaymentMethod::COURIER_COD->value)
                    ->orWhere('remaining_amount', '>', 0);
            });
        } elseif ($paymentFilter === 'PREPAID') {
            $invFiltered->where('remaining_amount', '<=', 0)
                ->where('payment_method', '!=', \App\Enums\PaymentMethod::COURIER_COD->value);
        }

        if ($search !== '') {
            $invFiltered->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                    ->orWhereHas('party', function ($pq) use ($search) {
                        $pq->where('name', 'like', "%{$search}%")
                            ->orWhere('phone', 'like', "%{$search}%");
                    });
            });
        }

        $includeWc = ($sourceFilter === 'ALL' || $sourceFilter === 'WOOCOMMERCE');
        $includeInv = ($sourceFilter === 'ALL' || $sourceFilter === 'DIRECT_SALE');

        $wcCount = $includeWc ? $wcFiltered->count() : 0;
        $invCount = $includeInv ? $invFiltered->count() : 0;
        $totalFiltered = $wcCount + $invCount;

        $perPage = 50;
        $page = max(1, (int) ($filters['page'] ?? request()->input('page', 1)));
        $offset = ($page - 1) * $perPage;

        $shipments = collect();

        if ($includeWc && $offset < $wcCount) {
            $wcTake = min($perPage, $wcCount - $offset);
            $wcOrders = $wcFiltered->with(['branch'])
                ->orderBy('id', 'desc')
                ->skip($offset)
                ->take($wcTake)
                ->get();

            foreach ($wcOrders as $order) {
                $isPaidOnline = $order->payment_status === WcPaymentStatus::PAID_ONLINE;
                $statusStr = $order->status instanceof \BackedEnum ? $order->status->value : (string) $order->status;
                $payStatusStr = $order->payment_status instanceof \BackedEnum ? $order->payment_status->value : (string) $order->payment_status;

                $shipments->push([
                    'id' => $order->id,
                    'source' => 'WOOCOMMERCE',
                    'reference' => '#' . $order->wc_order_id,
                    'wc_order_id' => $order->wc_order_id,
                    'invoice_id' => $order->invoice_id,
                    'customer_name' => $order->customer_name ?: 'عميل ووكومرس',
                    'customer_phone' => $order->customer_phone,
                    'customer_address' => $order->customer_address,
                    'city' => $order->city,
                    'tracking_number' => $order->tracking_number,
                    'branch_name' => $order->branch?->name,
                    'total' => Money::of($order->total)->getAmount(),
                    'shipping_cost' => Money::of($order->shipping_cost)->getAmount(),
                    'cod_amount' => $isPaidOnline ? 0.0 : Money::of($order->total)->getAmount(),
                    'status' => $statusStr,
                    'status_label' => $order->status->label(),
                    'payment_status' => $payStatusStr,
                    'payment_status_label' => $order->payment_status->label(),
                    'is_paid_online' => $isPaidOnline,
                    'shipped_at' => $order->shipped_at?->format('Y-m-d H:i'),
                    'created_at' => $order->created_at?->format('Y-m-d'),
                ]);
            }
        }

        $remainingSlots = $perPage - $shipments->count();
        if ($includeInv && $remainingSlots > 0) {
            $invOffset = max(0, $offset - $wcCount);
            if ($invOffset < $invCount) {
                $invTake = min($remainingSlots, $invCount - $invOffset);
                $directInvoices = $invFiltered->with(['party', 'branch'])
                    ->orderBy('id', 'desc')
                    ->skip($invOffset)
                    ->take($invTake)
                    ->get();

                foreach ($directInvoices as $inv) {
                    $isFullyPaid = Money::of($inv->remaining_amount)->isZeroOrNegative();
                    $isCourierCod = $inv->payment_method === \App\Enums\PaymentMethod::COURIER_COD;
                    $isPrepaid = $isFullyPaid && !$isCourierCod;

                    $shipments->push([
                        'id' => $inv->id,
                        'source' => 'DIRECT_SALE',
                        'reference' => $inv->invoice_number,
                        'wc_order_id' => null,
                        'invoice_id' => $inv->id,
                        'customer_name' => $inv->party?->name ?: 'عميل مباشر (POS)',
                        'customer_phone' => $inv->party?->phone,
                        'customer_address' => $inv->party?->address,
                        'city' => null,
                        'tracking_number' => null,
                        'branch_name' => $inv->branch?->name,
                        'total' => Money::of($inv->total)->getAmount(),
                        'shipping_cost' => Money::of($inv->shipping_amount)->getAmount(),
                        'cod_amount' => $isPrepaid ? 0.0 : Money::of($inv->total)->getAmount(),
                        'status' => $isFullyPaid ? WcOrderStatus::DELIVERED->value : StockTransferStatus::IN_TRANSIT->value,
                        'status_label' => $isFullyPaid ? 'تم التحصيل والتسليم' : 'قيد التوصيل والتحصيل',
                        'payment_status' => $isFullyPaid ? ($isCourierCod ? 'COLLECTED_COD' : 'PAID') : WcPaymentStatus::PENDING_COD->value,
                        'payment_status_label' => $isFullyPaid ? ($isCourierCod ? 'تحصيل عبر شركة شحن' : 'مدفوعة مقدماً') : 'متبقي تحصيل',
                        'is_paid_online' => $isPrepaid,
                        'shipped_at' => null,
                        'created_at' => $inv->date->format('Y-m-d'),
                    ]);
                }
            }
        }

        $lastPage = max(1, (int) ceil($totalFiltered / $perPage));

        return [
            'courier' => new PartyResource($courier),
            'shipments' => $shipments,
            'metrics' => $metrics,
            'pagination' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $totalFiltered,
            ],
            'meta' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $totalFiltered,
            ],
        ];
    }

    /**
     * تسجيل قيد استحقاق تحصيل الشحنة في دفتر شركة الشحن عند التسليم
     */
    public function recordDeliveryCollection(User $user, Invoice $invoice, WcOrder $order, float $collectedAmount): void
    {
        if (!$order->courier_party_id || $collectedAmount <= 0) {
            return;
        }

        DB::transaction(fn() => $this->persistDeliveryCollection($user, $invoice, $order, $collectedAmount));
    }

    private function persistDeliveryCollection(User $user, Invoice $invoice, WcOrder $order, float $collectedAmount): void
    {
        $courier = Party::where('user_id', $user->getAccountId())
            ->where('type', PartyType::COURIER->value)
            ->lockForUpdate()
            ->find($order->courier_party_id);

        if (!$courier) {
            return;
        }

        $alreadyRecorded = LedgerEntry::where('party_id', $courier->id)
            ->where('source_type', LedgerSource::INVOICE->value)
            ->where('source_id', $invoice->id)
            ->where('debit', '>', 0)
            ->exists();

        if ($alreadyRecorded) {
            return;
        }

        $desc = "تحصيل شحنة أوردر #{$order->wc_order_id} - العميل: " . ($order->customer_name ?: 'عميل ووكومرس');
        $this->ledgerService->recordEntry($user, $courier, LedgerSource::INVOICE->value, $invoice->id, $invoice->date->format('Y-m-d'), $desc, $collectedAmount, 0.0);
    }

    /**
     * تصفية رصيد ومستحقات شركة الشحن الصافية بضغطة واحدة
     */
    public function settleCourierNet(User $user, int $courierPartyId, array $data): array
    {
        $courier = Party::where('user_id', $user->getAccountId())->where('type', PartyType::COURIER->value)->findOrFail($courierPartyId);
        $balanceMoney = Money::of($courier->balance);
        $amountMoney = $this->validateSettlementAmount($balanceMoney, $data['amount'] ?? null);
        $type = $this->resolveSettlementType($balanceMoney, $data['type'] ?? null);

        $defaultNote = $type === PaymentType::RECEIPT ? "تصفية مستحقات شحن COD - شركة {$courier->name}" : "سداد أتعاب ومصاريف شحن - شركة {$courier->name}";
        $payment = $this->paymentService->createPayment($user, [
            'party_id' => $courier->id, 'type' => $type->value, 'amount' => $amountMoney->getAmount(),
            'method' => $data['method'] ?? PaymentMethod::CASH->value, 'date' => $data['date'] ?? now()->toDateString(),
            'notes' => $data['notes'] ?? $defaultNote, 'idempotency_key' => $data['idempotency_key'] ?? null,
        ]);

        $courier->refresh();

        return [
            'payment' => $payment->load(['party', 'treasury']),
            'courier' => (new PartyResource($courier))->resolve(),
            'settled_amount' => $amountMoney->getAmount(),
            'remaining_balance' => Money::of($courier->balance)->getAmount(),
        ];
    }

    private function validateSettlementAmount(Money $balanceMoney, mixed $rawAmount): Money
    {
        $maxAllowed = Money::of(abs($balanceMoney->getAmount()));
        if ($maxAllowed->isZero()) {
            throw new PosDomainException("رصيد شركة الشحن مسوى بالكامل بالفعل.", "SETTLEMENT_EXCEEDS_BALANCE", 422);
        }

        $amountMoney = !empty($rawAmount) ? Money::of($rawAmount) : $maxAllowed;
        if ($amountMoney->isZero() || $amountMoney->isNegative()) {
            throw new PosDomainException("المبلغ المطلوب تصفيته يجب أن يكون أكبر من الصفر.", "INVALID_SETTLEMENT_AMOUNT", 422);
        }
        if ($amountMoney->greaterThan($maxAllowed)) {
            throw new PosDomainException("المبلغ المطلوب تصفيته يتجاوز الرصيد المستحق لشركة الشحن.", "SETTLEMENT_EXCEEDS_BALANCE", 422);
        }

        return $amountMoney;
    }

    private function resolveSettlementType(Money $balanceMoney, mixed $requested): PaymentType
    {
        if (empty($requested)) {
            return $balanceMoney->greaterThan(Money::zero()) ? PaymentType::RECEIPT : PaymentType::PAYMENT;
        }

        $type = $requested instanceof PaymentType ? $requested : PaymentType::from($requested);
        if (($balanceMoney->greaterThan(Money::zero()) && $type !== PaymentType::RECEIPT)
            || ($balanceMoney->lessThan(Money::zero()) && $type !== PaymentType::PAYMENT)) {
            throw new PosDomainException("نوع السند غير متوافق مع اتجاه رصيد شركة الشحن.", "SETTLEMENT_DIRECTION_MISMATCH", 422);
        }

        return $type;
    }
}
