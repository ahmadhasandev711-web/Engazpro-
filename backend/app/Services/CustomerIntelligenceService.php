<?php

namespace App\Services;

use App\Enums\CrmRiskLevel;
use App\Enums\CustomerTier;
use App\Enums\InvoiceType;
use App\Enums\PartyType;
use App\Enums\WcOrderStatus;
use App\Models\Invoice;
use App\Models\OnlineOrder;
use App\Models\Party;
use App\Models\User;
use App\Support\Money;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CustomerIntelligenceService
{
    private const VIP_SPEND_THRESHOLD = 5000.0;

    public function enrichPartyCollection(User $actor, iterable $parties): void
    {
        $items = collect($parties)->filter(fn ($p) => $p instanceof Party && $p->type === PartyType::CUSTOMER->value)->values();
        if ($items->isEmpty()) {
            return;
        }

        $stats = $this->loadAggregatedCustomerStats($actor->getAccountId(), $items->pluck('id')->all(), $this->extractPartyPhones($items));
        foreach ($items as $party) {
            $metrics = $this->resolveMetricsForKeys((int) $party->id, $this->normalizePhone($party->phone), $stats, $party->crm_tier_override);
            $party->setAttribute('crm_metrics', $metrics);
        }
    }

    public function enrichOnlineOrderCollection(User $actor, iterable $orders): void
    {
        $items = collect($orders)->filter(fn ($o) => $o instanceof OnlineOrder)->values();
        if ($items->isEmpty()) {
            return;
        }

        $partyIds = $items->pluck('party_id')->filter()->unique()->values()->all();
        $phones = $items->map(fn (OnlineOrder $o) => $this->resolveOrderPhone($o))->filter()->unique()->values()->all();
        $stats = $this->loadAggregatedCustomerStats($actor->getAccountId(), $partyIds, $phones);

        foreach ($items as $order) {
            $override = $order->relationLoaded('party') ? $order->party?->crm_tier_override : null;
            $phoneKey = $this->resolveOrderPhone($order);
            $order->setAttribute('customer_crm', $this->resolveMetricsForKeys($order->party_id ? (int) $order->party_id : null, $phoneKey, $stats, $override));
        }
    }

    private function resolveOrderPhone(OnlineOrder $order): ?string
    {
        $raw = $order->customer_phone ?: ($order->relationLoaded('party') ? $order->party?->phone : null);

        return $this->normalizePhone($raw);
    }

    private function extractPartyPhones(Collection $parties): array
    {
        return $parties->map(fn (Party $p) => $this->normalizePhone($p->phone))->filter()->unique()->values()->all();
    }

    private function normalizePhone(?string $phone): ?string
    {
        if ($phone === null) {
            return null;
        }
        $clean = preg_replace('/[^\d+]/', '', trim($phone));

        return $clean !== '' ? $clean : null;
    }

    private function loadAggregatedCustomerStats(int $accountId, array $partyIds, array $phones): array
    {
        if (empty($partyIds) && empty($phones)) {
            return ['orders' => [], 'by_party_orders' => [], 'by_phone_orders' => [], 'invoices_by_party' => []];
        }

        [$orders, $byPartyOrders, $byPhoneOrders] = $this->fetchOnlineOrderIndex($accountId, $partyIds, $phones);
        $invoicesByParty = $this->fetchInvoiceAggregates($accountId, $partyIds);

        return ['orders' => $orders, 'by_party_orders' => $byPartyOrders, 'by_phone_orders' => $byPhoneOrders, 'invoices_by_party' => $invoicesByParty];
    }

    private function fetchOnlineOrderIndex(int $accountId, array $partyIds, array $phones): array
    {
        $rows = OnlineOrder::withoutGlobalScopes()->where('user_id', $accountId)
            ->where(function ($q) use ($partyIds, $phones) {
                if (!empty($partyIds)) {
                    $q->whereIn('party_id', $partyIds);
                }
                if (!empty($phones)) {
                    $q->orWhereIn('customer_phone', $phones);
                }
            })->get(['id', 'party_id', 'customer_phone', 'status', 'total', 'order_date', 'created_at']);

        $orders = [];
        $byParty = [];
        $byPhone = [];
        foreach ($rows as $row) {
            $orders[(int) $row->id] = $row;
            if ($row->party_id) {
                $byParty[(int) $row->party_id][] = (int) $row->id;
            }
            if ($phone = $this->normalizePhone($row->customer_phone)) {
                $byPhone[$phone][] = (int) $row->id;
            }
        }

        return [$orders, $byParty, $byPhone];
    }

    private function fetchInvoiceAggregates(int $accountId, array $partyIds): array
    {
        if (empty($partyIds)) {
            return [];
        }

        $rows = Invoice::withoutGlobalScopes()->where('user_id', $accountId)->whereIn('party_id', $partyIds)
            ->whereNull('online_order_id')->whereIn('type', [InvoiceType::SALE->value, InvoiceType::SALE_RETURN->value])
            ->select('party_id', 'type', DB::raw('COUNT(*) as cnt'), DB::raw('COALESCE(SUM(total), 0) as sum_total'), DB::raw('MAX(date) as max_date'))
            ->groupBy('party_id', 'type')->get();

        $buckets = [];
        foreach ($rows as $row) {
            $this->mergeInvoiceRow($buckets[(int) $row->party_id], $row);
        }

        return $buckets;
    }

    private function mergeInvoiceRow(?array &$bucket, object $row): void
    {
        $bucket ??= $this->emptyBucket();
        if ($row->type === InvoiceType::SALE->value || $row->type === InvoiceType::SALE) {
            $bucket['delivered'] += (int) $row->cnt;
            $bucket['spent'] = Money::of($bucket['spent'])->add($row->sum_total ?? 0)->getAmount();
        } else {
            $bucket['cancelled'] += (int) $row->cnt;
        }
        $dateIso = $row->max_date ? Carbon::parse($row->max_date)->toIso8601String() : null;
        if ($dateIso && ($bucket['last_at'] === null || $dateIso > $bucket['last_at'])) {
            $bucket['last_at'] = $dateIso;
        }
    }

    private function emptyBucket(): array
    {
        return ['delivered' => 0, 'cancelled' => 0, 'active' => 0, 'spent' => 0.0, 'last_at' => null];
    }

    private function resolveMetricsForKeys(?int $partyId, ?string $phone, array $stats, ?CustomerTier $override): array
    {
        $bucket = ($partyId !== null && isset($stats['invoices_by_party'][$partyId]))
            ? $stats['invoices_by_party'][$partyId]
            : $this->emptyBucket();

        $orderIds = array_unique(array_merge(
            $partyId !== null ? ($stats['by_party_orders'][$partyId] ?? []) : [],
            $phone !== null ? ($stats['by_phone_orders'][$phone] ?? []) : []
        ));

        foreach ($orderIds as $orderId) {
            if (isset($stats['orders'][$orderId])) {
                $this->applyOrderToBucket($bucket, $stats['orders'][$orderId]);
            }
        }

        return $this->buildMetricsPayload($bucket, $override);
    }

    private function applyOrderToBucket(array &$bucket, OnlineOrder $order): void
    {
        $status = $order->status instanceof \BackedEnum ? $order->status : WcOrderStatus::tryFrom((string) $order->status);
        $amount = Money::of($order->total ?? 0);
        if ($status === WcOrderStatus::DELIVERED) {
            $bucket['delivered']++;
            $bucket['spent'] = Money::of($bucket['spent'])->add($amount)->getAmount();
        } elseif (in_array($status, [WcOrderStatus::CANCELLED, WcOrderStatus::RETURNED], true)) {
            $bucket['cancelled']++;
        } else {
            $bucket['active']++;
        }

        $dateIso = ($order->order_date ?? $order->created_at)?->toIso8601String();
        if ($dateIso && ($bucket['last_at'] === null || $dateIso > $bucket['last_at'])) {
            $bucket['last_at'] = $dateIso;
        }
    }

    private function buildMetricsPayload(array $bucket, ?CustomerTier $override): array
    {
        $delivered = (int) $bucket['delivered'];
        $cancelled = (int) $bucket['cancelled'];
        $active = (int) $bucket['active'];
        $closedTotal = $delivered + $cancelled;
        $rate = $closedTotal > 0 ? round(($cancelled / $closedTotal) * 100, 1) : 0.0;

        $autoTier = $this->classifyTier($delivered, $cancelled, $rate, Money::of($bucket['spent']));
        $effectiveTier = $override ?? $autoTier;
        [$riskLevel, $showWarning, $warningMessage] = $this->evaluateRiskWarning($effectiveTier, $cancelled, $closedTotal, $rate);

        return [
            'auto_tier' => $autoTier->value, 'effective_tier' => $effectiveTier->value,
            'tier_label' => $effectiveTier->label(), 'is_manual_override' => $override !== null,
            'risk_level' => $riskLevel->value, 'delivered_orders_count' => $delivered,
            'cancelled_or_returned_count' => $cancelled, 'active_orders_count' => $active,
            'total_orders_count' => $delivered + $cancelled + $active, 'cancellation_rate' => $rate,
            'total_spent' => Money::of($bucket['spent'])->getAmount(), 'last_order_at' => $bucket['last_at'],
            'show_warning' => $showWarning, 'warning_message' => $warningMessage,
        ];
    }

    private function classifyTier(int $delivered, int $cancelled, float $rate, Money $spent): CustomerTier
    {
        if ($cancelled >= 3 && $rate >= 50.0) {
            return CustomerTier::BLACKLISTED;
        }
        if ($cancelled >= 2 || ($cancelled >= 1 && $delivered <= 1 && $rate >= 35.0)) {
            return CustomerTier::HIGH_CANCELLATION;
        }
        if (($delivered >= 5 && $spent->getAmount() >= self::VIP_SPEND_THRESHOLD && $rate < 25.0) || $delivered >= 10) {
            return CustomerTier::VIP;
        }
        if ($delivered >= 2 && $rate < 35.0) {
            return CustomerTier::REPEAT;
        }

        return CustomerTier::REGULAR;
    }

    /**
     * @return array{0: CrmRiskLevel, 1: bool, 2: ?string}
     */
    private function evaluateRiskWarning(CustomerTier $tier, int $cancelled, int $closedTotal, float $rate): array
    {
        if ($tier === CustomerTier::BLACKLISTED) {
            $detail = $cancelled > 0 ? " (ألغى/رفض {$cancelled} من أصل {$closedTotal} طلب)" : '';
            return [CrmRiskLevel::HIGH, true, "تحذير حظر: هذا العميل مصنف كرافض استلام متكرر{$detail}. يُرجى التأكيد بدفع مسبق."];
        }
        if ($tier === CustomerTier::HIGH_CANCELLATION || $cancelled > 0) {
            $level = $tier === CustomerTier::HIGH_CANCELLATION ? CrmRiskLevel::MEDIUM : CrmRiskLevel::LOW;
            return [$level, true, "تنبيه سجل العميل: لديه {$cancelled} طلب ملغي/مرتجع سابقاً (نسبة {$rate}%)."];
        }

        return [CrmRiskLevel::NONE, false, null];
    }
}
