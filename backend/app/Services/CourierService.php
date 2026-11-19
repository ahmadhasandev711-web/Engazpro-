<?php

namespace App\Services;

use App\Enums\EcommercePlatform;
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
use App\Models\OnlineOrder;
use App\Models\Party;
use App\Models\User;
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
        $scope = app(BranchScopeService::class);
        $branchId = $scope->shouldFailClosedWithoutBranch($user) ? -1 : $scope->resolveQueryBranchId($user);
        $wcStats = $this->fetchCourierWcStats($accountId, $courierIds, $branchId);
        $invoiceStats = $this->fetchCourierDirectInvoiceStats($accountId, $courierIds, $branchId);

        $couriersWithStats = $couriers->map(fn(Party $courier) => $this->buildCourierMetricRow($courier, $wcStats->get($courier->id), $invoiceStats->get($courier->id)));

        return [
            'couriers' => $couriersWithStats,
            'summary' => $this->buildCourierSummary($couriers->count(), $couriersWithStats),
        ];
    }

    private function fetchCourierWcStats(int $accountId, array $courierIds, ?int $branchId = null)
    {
        return OnlineOrder::where('user_id', $accountId)
            ->whereIn('courier_party_id', $courierIds)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
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

    private function fetchCourierDirectInvoiceStats(int $accountId, array $courierIds, ?int $branchId = null)
    {
        return Invoice::where('user_id', $accountId)
            ->whereIn('courier_party_id', $courierIds)
            ->when($branchId !== null, fn ($q) => $q->where('branch_id', $branchId))
            ->whereNull('online_order_id')
            ->whereNull('wc_order_id')
            ->whereNull('shopify_order_id')
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
        $courier = Party::where('user_id', $accountId)->where('type', PartyType::COURIER->value)->findOrFail($courierPartyId);
        $effectiveBranchId = $this->resolveManifestBranchId($user, $branchId);
        [$wcBase, $invBase] = $this->buildManifestBaseQueries($accountId, $courier->id, $effectiveBranchId);
        $metrics = $this->computeManifestMetrics(clone $wcBase, clone $invBase);

        [$wcFiltered, $invFiltered] = $this->applyManifestFilters(clone $wcBase, clone $invBase, $filters);
        [$shipments, $totalFiltered, $page, $perPage] = $this->paginateManifestShipments($wcFiltered, $invFiltered, $filters);
        $pagination = ['current_page' => $page, 'last_page' => max(1, (int) ceil($totalFiltered / $perPage)), 'per_page' => $perPage, 'total' => $totalFiltered];

        return [
            'courier' => new PartyResource($courier),
            'shipments' => $shipments,
            'metrics' => $metrics,
            'pagination' => $pagination,
            'meta' => $pagination,
        ];
    }

    private function resolveManifestBranchId(User $user, ?int $branchId): ?int
    {
        $scope = app(BranchScopeService::class);
        if ($scope->shouldFailClosedWithoutBranch($user)) {
            return -1;
        }

        return $scope->resolveQueryBranchId($user, $branchId);
    }

    private function buildManifestBaseQueries(int $accountId, int $courierId, ?int $branchId): array
    {
        $online = OnlineOrder::where('user_id', $accountId)->where('courier_party_id', $courierId)->when($branchId, fn ($q) => $q->where('branch_id', $branchId));
        $inv = Invoice::where('user_id', $accountId)->where('courier_party_id', $courierId)->whereNull('online_order_id')->whereNull('wc_order_id')->whereNull('shopify_order_id')->when($branchId, fn ($q) => $q->where('branch_id', $branchId));

        return [$online, $inv];
    }

    private function computeManifestMetrics($wcBaseQuery, $invBaseQuery): array
    {
        $wc = $wcBaseQuery->selectRaw(
            'COUNT(*) as total_count, COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as in_transit_count, COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as delivered_count, COALESCE(SUM(CASE WHEN status = ? THEN 1 ELSE 0 END), 0) as returned_count, COALESCE(SUM(total), 0) as total_amount, COALESCE(SUM(shipping_cost), 0) as total_shipping, COALESCE(SUM(CASE WHEN payment_status = ? THEN total ELSE 0 END), 0) as collected_amount, COALESCE(SUM(CASE WHEN status = ? AND payment_status != ? THEN total ELSE 0 END), 0) as pending_amount',
            [WcOrderStatus::SHIPPED_VIA_COURIER->value, WcOrderStatus::DELIVERED->value, WcOrderStatus::RETURNED->value, WcPaymentStatus::COLLECTED->value, WcOrderStatus::SHIPPED_VIA_COURIER->value, WcPaymentStatus::PAID_ONLINE->value]
        )->first();
        $inv = $invBaseQuery->selectRaw('COUNT(*) as total_count, COALESCE(SUM(CASE WHEN remaining_amount > 0 THEN 1 ELSE 0 END), 0) as in_transit_count, COALESCE(SUM(CASE WHEN remaining_amount <= 0 THEN 1 ELSE 0 END), 0) as delivered_count, COALESCE(SUM(total), 0) as total_amount, COALESCE(SUM(shipping_amount), 0) as total_shipping, COALESCE(SUM(CASE WHEN remaining_amount <= 0 THEN total ELSE 0 END), 0) as collected_amount, COALESCE(SUM(CASE WHEN remaining_amount > 0 THEN total ELSE 0 END), 0) as pending_amount')->first();

        return [
            'total_shipments' => (int) ($wc->total_count ?? 0) + (int) ($inv->total_count ?? 0),
            'in_transit_count' => (int) ($wc->in_transit_count ?? 0) + (int) ($inv->in_transit_count ?? 0),
            'delivered_count' => (int) ($wc->delivered_count ?? 0) + (int) ($inv->delivered_count ?? 0),
            'returned_count' => (int) ($wc->returned_count ?? 0),
            'total_cod_amount' => Money::of($wc->total_amount ?? 0)->add(Money::of($inv->total_amount ?? 0))->getAmount(),
            'total_shipping_fees' => Money::of($wc->total_shipping ?? 0)->add(Money::of($inv->total_shipping ?? 0))->getAmount(),
            'collected_cod_amount' => Money::of($wc->collected_amount ?? 0)->add(Money::of($inv->collected_amount ?? 0))->getAmount(),
            'pending_cod_amount' => Money::of($wc->pending_amount ?? 0)->add(Money::of($inv->pending_amount ?? 0))->getAmount(),
        ];
    }

    private function applyManifestFilters($wcFiltered, $invFiltered, array $filters): array
    {
        $statusFilter = $filters['status'] ?? 'ALL';
        $paymentFilter = $filters['payment_status'] ?? 'ALL';
        $search = trim((string) ($filters['search'] ?? ''));

        $this->applyManifestWcFilters($wcFiltered, $statusFilter, $paymentFilter, $search);
        $this->applyManifestInvFilters($invFiltered, $statusFilter, $paymentFilter, $search);

        return [$wcFiltered, $invFiltered];
    }

    private function applyManifestWcFilters($query, string $statusFilter, string $paymentFilter, string $search): void
    {
        match ($statusFilter) {
            StockTransferStatus::IN_TRANSIT->value => $query->where('status', WcOrderStatus::SHIPPED_VIA_COURIER->value),
            WcOrderStatus::DELIVERED->value => $query->where('status', WcOrderStatus::DELIVERED->value),
            WcOrderStatus::RETURNED->value => $query->where('status', WcOrderStatus::RETURNED->value),
            default => null,
        };
        if ($paymentFilter === 'COD') {
            $query->where('payment_status', '!=', WcPaymentStatus::PAID_ONLINE->value);
        } elseif ($paymentFilter === 'PREPAID') {
            $query->where('payment_status', WcPaymentStatus::PAID_ONLINE->value);
        }
        if ($search !== '') {
            $query->where(fn ($q) => $q->where('external_order_id', 'like', "%{$search}%")->orWhere('external_order_number', 'like', "%{$search}%")->orWhere('customer_name', 'like', "%{$search}%")->orWhere('customer_phone', 'like', "%{$search}%")->orWhere('tracking_number', 'like', "%{$search}%"));
        }
    }

    private function applyManifestInvFilters($query, string $statusFilter, string $paymentFilter, string $search): void
    {
        match ($statusFilter) {
            StockTransferStatus::IN_TRANSIT->value => $query->where('remaining_amount', '>', 0),
            WcOrderStatus::DELIVERED->value => $query->where('remaining_amount', '<=', 0),
            WcOrderStatus::RETURNED->value => $query->whereRaw('0 = 1'),
            default => null,
        };
        if ($paymentFilter === 'COD') {
            $query->where(fn ($q) => $q->where('payment_method', \App\Enums\PaymentMethod::COURIER_COD->value)->orWhere('remaining_amount', '>', 0));
        } elseif ($paymentFilter === 'PREPAID') {
            $query->where('remaining_amount', '<=', 0)->where('payment_method', '!=', \App\Enums\PaymentMethod::COURIER_COD->value);
        }
        if ($search !== '') {
            $query->where(fn ($q) => $q->where('invoice_number', 'like', "%{$search}%")->orWhereHas('party', fn ($pq) => $pq->where('name', 'like', "%{$search}%")->orWhere('phone', 'like', "%{$search}%")));
        }
    }

    private function paginateManifestShipments($wcFiltered, $invFiltered, array $filters): array
    {
        $source = strtoupper((string) ($filters['source'] ?? 'ALL'));
        $wcCount = $this->applyManifestSourceFilter($wcFiltered, $source) ? $wcFiltered->count() : 0;
        $invCount = ($source === 'ALL' || $source === 'DIRECT_SALE') ? $invFiltered->count() : 0;
        $perPage = 50;
        $page = max(1, (int) ($filters['page'] ?? request()->input('page', 1)));
        $offset = ($page - 1) * $perPage;
        $shipments = collect();

        if ($wcCount > 0 && $offset < $wcCount) {
            foreach ($wcFiltered->with(['branch'])->orderBy('id', 'desc')->skip($offset)->take(min($perPage, $wcCount - $offset))->get() as $order) {
                $shipments->push($this->formatWcManifestShipment($order));
            }
        }
        $remaining = $perPage - $shipments->count();
        $invOffset = max(0, $offset - $wcCount);
        if ($invCount > 0 && $remaining > 0 && $invOffset < $invCount) {
            foreach ($invFiltered->with(['party', 'branch'])->orderBy('id', 'desc')->skip($invOffset)->take(min($remaining, $invCount - $invOffset))->get() as $inv) {
                $shipments->push($this->formatDirectManifestShipment($inv));
            }
        }

        return [$shipments, $wcCount + $invCount, $page, $perPage];
    }

    private function applyManifestSourceFilter($query, string $source): bool
    {
        if (!in_array($source, ['ALL', 'ONLINE_ORDER', 'WOOCOMMERCE', 'SHOPIFY'], true)) {
            return false;
        }
        if ($source === 'WOOCOMMERCE') {
            $query->where('platform', EcommercePlatform::WOOCOMMERCE->value);
        } elseif ($source === 'SHOPIFY') {
            $query->where('platform', EcommercePlatform::SHOPIFY->value);
        }

        return true;
    }

    private function formatWcManifestShipment(OnlineOrder $order): array
    {
        $isPaidOnline = $order->payment_status === WcPaymentStatus::PAID_ONLINE;

        return [
            'id' => $order->id, 'source' => strtoupper($order->platform->value), 'platform' => $order->platform->value,
            'platform_label' => $order->platform->label(), 'reference' => $order->displayReference(),
            'wc_order_id' => $order->external_order_id, 'invoice_id' => $order->invoice_id,
            'customer_name' => $order->customer_name ?: "عميل {$order->platform->label()}", 'customer_phone' => $order->customer_phone,
            'customer_address' => $order->customer_address, 'city' => $order->city, 'tracking_number' => $order->tracking_number,
            'branch_name' => $order->branch?->name, 'total' => Money::of($order->total)->getAmount(),
            'shipping_cost' => Money::of($order->shipping_cost)->getAmount(),
            'cod_amount' => $isPaidOnline ? 0.0 : Money::of($order->total)->getAmount(),
            'status' => $order->status instanceof \BackedEnum ? $order->status->value : (string) $order->status,
            'status_label' => $order->status->label(),
            'payment_status' => $order->payment_status instanceof \BackedEnum ? $order->payment_status->value : (string) $order->payment_status,
            'payment_status_label' => $order->payment_status->label(), 'is_paid_online' => $isPaidOnline,
            'shipped_at' => $order->shipped_at?->format('Y-m-d H:i'), 'created_at' => $order->created_at?->format('Y-m-d'),
        ];
    }

    private function formatDirectManifestShipment(Invoice $inv): array
    {
        $isFullyPaid = Money::of($inv->remaining_amount)->isZeroOrNegative();
        $isCourierCod = $inv->payment_method === \App\Enums\PaymentMethod::COURIER_COD;
        $isPrepaid = $isFullyPaid && !$isCourierCod;

        return [
            'id' => $inv->id, 'source' => 'DIRECT_SALE', 'reference' => $inv->invoice_number, 'wc_order_id' => null,
            'invoice_id' => $inv->id, 'customer_name' => $inv->party?->name ?: 'عميل مباشر (POS)',
            'customer_phone' => $inv->party?->phone, 'customer_address' => $inv->party?->address, 'city' => null, 'tracking_number' => null,
            'branch_name' => $inv->branch?->name, 'total' => Money::of($inv->total)->getAmount(),
            'shipping_cost' => Money::of($inv->shipping_amount)->getAmount(),
            'cod_amount' => $isPrepaid ? 0.0 : Money::of($inv->total)->getAmount(),
            'status' => $isFullyPaid ? WcOrderStatus::DELIVERED->value : StockTransferStatus::IN_TRANSIT->value,
            'status_label' => $isFullyPaid ? 'تم التحصيل والتسليم' : 'قيد التوصيل والتحصيل',
            'payment_status' => $isFullyPaid ? ($isCourierCod ? 'COLLECTED_COD' : 'PAID') : WcPaymentStatus::PENDING_COD->value,
            'payment_status_label' => $isFullyPaid ? ($isCourierCod ? 'تحصيل عبر شركة شحن' : 'مدفوعة مقدماً') : 'متبقي تحصيل',
            'is_paid_online' => $isPrepaid, 'shipped_at' => null, 'created_at' => $inv->date->format('Y-m-d'),
        ];
    }

    /**
     * تسجيل قيد استحقاق تحصيل الشحنة في دفتر شركة الشحن عند التسليم
     */
    public function recordDeliveryCollection(User $user, Invoice $invoice, OnlineOrder $order, float $collectedAmount): void
    {
        if (!$order->courier_party_id || $collectedAmount <= 0) {
            return;
        }

        DB::transaction(fn() => $this->persistDeliveryCollection($user, $invoice, $order, $collectedAmount));
    }

    private function persistDeliveryCollection(User $user, Invoice $invoice, OnlineOrder $order, float $collectedAmount): void
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

        $ref = $order->displayReference();
        $fallbackCustomer = "عميل {$order->platform->label()}";
        $desc = "تحصيل شحنة أوردر {$ref} - العميل: " . ($order->customer_name ?: $fallbackCustomer);
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
