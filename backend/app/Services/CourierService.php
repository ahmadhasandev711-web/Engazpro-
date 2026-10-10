<?php

namespace App\Services;

use App\Enums\PartyType;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Http\Resources\PartyResource;
use App\Models\Invoice;
use App\Models\LedgerEntry;
use App\Models\Party;
use App\Models\User;
use App\Models\WcOrder;
use App\Support\Money;
use Illuminate\Support\Facades\DB;

class CourierService
{
    public function __construct(
        protected LedgerService $ledgerService
    ) {}

    /**
     * جلب قائمة شركات الشحن مع إحصائيات الطرود والتحصيلات والأرصدة
     */
    public function getCouriersWithMetrics(User $user, ?string $search = null): array
    {
        $accountId = $user->getAccountId();

        $query = Party::where('user_id', $accountId)
            ->where('type', PartyType::COURIER->value);

        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('notes', 'like', "%{$search}%");
            });
        }

        $couriers = $query->orderBy('name')->get();

        $couriersWithStats = $couriers->map(function (Party $courier) {
            $activeOrdersCount = WcOrder::where('courier_party_id', $courier->id)
                ->where('status', WcOrderStatus::SHIPPED_VIA_COURIER)
                ->count();

            $deliveredOrdersCount = WcOrder::where('courier_party_id', $courier->id)
                ->where('status', WcOrderStatus::DELIVERED)
                ->count();

            $totalOrdersCount = WcOrder::where('courier_party_id', $courier->id)->count();

            $pendingCodAmount = (float) WcOrder::where('courier_party_id', $courier->id)
                ->where('status', WcOrderStatus::SHIPPED_VIA_COURIER)
                ->where('payment_status', '!=', WcPaymentStatus::PAID_ONLINE)
                ->sum('total');

            $activeDirectInvoicesCount = Invoice::where('courier_party_id', $courier->id)
                ->whereNull('wc_order_id')
                ->where('remaining_amount', '>', 0)
                ->count();

            $pendingDirectInvoiceAmount = (float) Invoice::where('courier_party_id', $courier->id)
                ->whereNull('wc_order_id')
                ->sum('remaining_amount');

            $data = (new PartyResource($courier))->resolve();
            $data['active_shipments_count'] = $activeOrdersCount + $activeDirectInvoicesCount;
            $data['delivered_shipments_count'] = $deliveredOrdersCount;
            $data['total_shipments_count'] = $totalOrdersCount + Invoice::where('courier_party_id', $courier->id)->whereNull('wc_order_id')->count();
            $data['pending_cod_amount'] = Money::of($pendingCodAmount + $pendingDirectInvoiceAmount)->getAmount();

            return $data;
        });

        $globalActiveShipments = (int) $couriersWithStats->sum('active_shipments_count');
        $globalPendingCod = Money::of($couriersWithStats->sum('pending_cod_amount'))->getAmount();
        $globalNetBalance = Money::of($couriersWithStats->sum(fn ($c) => (float) $c['balance']))->getAmount();

        return [
            'couriers' => $couriersWithStats,
            'summary' => [
                'total_couriers' => $couriers->count(),
                'global_active_shipments' => $globalActiveShipments,
                'global_pending_cod' => $globalPendingCod,
                'global_net_balance' => $globalNetBalance,
            ],
        ];
    }

    /**
     * استخراج كشف الشحنات والبوالص التفصيلي لشركة الشحن (Manifest)
     */
    public function getCourierManifest(User $user, int $courierPartyId, ?int $branchId = null): array
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

        $wcOrders = WcOrder::where('user_id', $accountId)
            ->where('courier_party_id', $courier->id)
            ->when($effectiveBranchId, fn ($q) => $q->where('branch_id', $effectiveBranchId))
            ->with(['branch'])
            ->orderBy('id', 'desc')
            ->get();

        $directInvoices = Invoice::where('user_id', $accountId)
            ->where('courier_party_id', $courier->id)
            ->whereNull('wc_order_id')
            ->when($effectiveBranchId, fn ($q) => $q->where('branch_id', $effectiveBranchId))
            ->with(['party', 'branch'])
            ->orderBy('id', 'desc')
            ->get();

        $shipments = collect();

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

        foreach ($directInvoices as $inv) {
            $isFullyPaid = (float) $inv->remaining_amount <= 0.001;
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
                'status' => $isFullyPaid ? 'DELIVERED' : 'IN_TRANSIT',
                'status_label' => $isFullyPaid ? 'تم التحصيل والتسليم' : 'قيد التوصيل والتحصيل',
                'payment_status' => $isFullyPaid ? ($isCourierCod ? 'COLLECTED_COD' : 'PAID') : 'PENDING_COD',
                'payment_status_label' => $isFullyPaid ? ($isCourierCod ? 'تحصيل عبر شركة شحن' : 'مدفوعة مقدماً') : 'متبقي تحصيل',
                'is_paid_online' => $isPrepaid,
                'shipped_at' => null,
                'created_at' => $inv->date->format('Y-m-d'),
            ]);
        }

        $totalShipments = $shipments->count();
        $inTransitCount = $shipments->where('status', 'SHIPPED_VIA_COURIER')->count() + $shipments->where('status', 'IN_TRANSIT')->count();
        $deliveredCount = $shipments->where('status', 'DELIVERED')->count();
        $returnedCount = $shipments->where('status', 'RETURNED')->count();
        $totalCodAmount = Money::of($shipments->sum('total'))->getAmount();
        $totalShippingFees = Money::of($shipments->sum('shipping_cost'))->getAmount();
        $collectedCodAmount = Money::of($shipments->where('payment_status', 'COLLECTED')->sum('total') + $shipments->where('payment_status', 'PAID')->sum('total'))->getAmount();
        $pendingCodAmount = Money::of($shipments->filter(fn ($s) => in_array($s['status'], ['SHIPPED_VIA_COURIER', 'IN_TRANSIT']) && !$s['is_paid_online'])->sum('total'))->getAmount();

        return [
            'courier' => new PartyResource($courier),
            'shipments' => $shipments,
            'metrics' => [
                'total_shipments' => $totalShipments,
                'in_transit_count' => $inTransitCount,
                'delivered_count' => $deliveredCount,
                'returned_count' => $returnedCount,
                'total_cod_amount' => $totalCodAmount,
                'total_shipping_fees' => $totalShippingFees,
                'collected_cod_amount' => $collectedCodAmount,
                'pending_cod_amount' => $pendingCodAmount,
            ],
        ];
    }

    /**
     * تسجيل قيد استحقاق تحصيل الشحنة في دفتر شركة الشحن عند التسليم
     */
    public function recordDeliveryCollection(User $user, Invoice $invoice, WcOrder $order, float $collectedAmount): void
    {
        if (!$order->courier_party_id) {
            return;
        }

        DB::transaction(function () use ($user, $invoice, $order, $collectedAmount) {
            $courier = Party::where('user_id', $user->getAccountId())
                ->where('type', PartyType::COURIER->value)
                ->lockForUpdate()
                ->find($order->courier_party_id);

            if (!$courier || $collectedAmount <= 0) {
                return;
            }

            // منع تكرار قيد التحصيل لنفس الفاتورة
            $alreadyRecorded = LedgerEntry::where('party_id', $courier->id)
                ->where('source_type', 'INVOICE')
                ->where('source_id', $invoice->id)
                ->where('debit', '>', 0)
                ->exists();

            if ($alreadyRecorded) {
                return;
            }

            $desc = "تحصيل شحنة أوردر #{$order->wc_order_id} - العميل: " . ($order->customer_name ?: 'عميل ووكومرس');

            $this->ledgerService->recordEntry(
                user: $user,
                party: $courier,
                sourceType: 'INVOICE',
                sourceId: $invoice->id,
                date: $invoice->date->format('Y-m-d'),
                description: $desc,
                debit: $collectedAmount,
                credit: 0.0
            );
        });
    }

    /**
     * تدقيق وتصحيح الأوردرات المسلمة سابقاً ومزامنة قيودها في كشف حساب شركة الشحن
     */
    public function syncExistingDeliveredOrders(User $user): int
    {
        $accountId = $user->getAccountId();

        $deliveredOrders = WcOrder::where('user_id', $accountId)
            ->whereNotNull('courier_party_id')
            ->where('status', WcOrderStatus::DELIVERED)
            ->whereNotNull('invoice_id')
            ->get();

        $syncedCount = 0;

        foreach ($deliveredOrders as $order) {
            $invoice = Invoice::find($order->invoice_id);
            if (!$invoice) {
                continue;
            }

            $courier = Party::where('user_id', $accountId)->find($order->courier_party_id);
            if (!$courier) {
                continue;
            }

            $alreadyRecorded = LedgerEntry::where('party_id', $courier->id)
                ->where('source_type', 'INVOICE')
                ->where('source_id', $invoice->id)
                ->where('debit', '>', 0)
                ->exists();

            if (!$alreadyRecorded) {
                $collected = (float) $invoice->total;
                $desc = "تحصيل شحنة أوردر #{$order->wc_order_id} - العميل: " . ($order->customer_name ?: 'عميل ووكومرس');

                $this->ledgerService->recordEntry(
                    user: $user,
                    party: $courier,
                    sourceType: 'INVOICE',
                    sourceId: $invoice->id,
                    date: $invoice->date->format('Y-m-d'),
                    description: $desc,
                    debit: $collected,
                    credit: 0.0
                );
                $syncedCount++;
            }

            $this->ledgerService->auditAndRecalculateBalance($courier);
        }

        return $syncedCount;
    }
}
