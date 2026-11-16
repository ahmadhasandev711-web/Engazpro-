<?php

namespace App\Services;

use App\Enums\InvoiceType;
use App\Enums\PaymentMethod;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\User;
use App\Support\Money;
use App\Support\Quantity;
use Illuminate\Support\Facades\DB;

class PurchaseReportService
{
    public function getPurchaseReport(User $user, ?string $fromDate = null, ?string $toDate = null, ?int $branchId = null): array
    {
        $effectiveBranchId = ($user->isManager() && $user->branch_id) ? (int) $user->branch_id : $branchId;

        return [
            'period' => ['from_date' => $fromDate, 'to_date' => $toDate, 'branch_id' => $effectiveBranchId],
            'summary' => $this->buildPurchaseSummary($fromDate, $toDate, $effectiveBranchId),
            'top_suppliers' => $this->fetchTopSuppliers($fromDate, $toDate, $effectiveBranchId),
            'top_products' => $this->fetchTopPurchasedProducts($fromDate, $toDate, $effectiveBranchId),
        ];
    }

    private function buildPurchaseSummary(?string $fromDate, ?string $toDate, ?int $branchId): array
    {
        $pur = $this->scopedInvoicesQuery(InvoiceType::PURCHASE->value, $fromDate, $toDate, $branchId)
            ->selectRaw('COUNT(*) as cnt, COALESCE(SUM(total), 0) as total, COALESCE(SUM(paid_amount), 0) as paid, COALESCE(SUM(remaining_amount), 0) as remaining, COALESCE(SUM(CASE WHEN payment_method = ? THEN total ELSE 0 END), 0) as cash_total, COALESCE(SUM(CASE WHEN payment_method = ? THEN total ELSE 0 END), 0) as credit_total', [PaymentMethod::CASH->value, PaymentMethod::CREDIT->value])
            ->first();
        $ret = $this->scopedInvoicesQuery(InvoiceType::PURCHASE_RETURN->value, $fromDate, $toDate, $branchId)
            ->selectRaw('COUNT(*) as cnt, COALESCE(SUM(total), 0) as total')->first();

        $totalPurchases = Money::of($pur->total ?? 0);
        $returns = Money::of($ret->total ?? 0);

        return [
            'total_purchases' => $totalPurchases->getAmount(),
            'total_purchase_returns' => $returns->getAmount(),
            'net_purchases' => $totalPurchases->subtract($returns)->getAmount(),
            'cash_purchases' => Money::of($pur->cash_total ?? 0)->getAmount(),
            'credit_purchases' => Money::of($pur->credit_total ?? 0)->getAmount(),
            'total_paid' => Money::of($pur->paid ?? 0)->getAmount(),
            'total_remaining' => Money::of($pur->remaining ?? 0)->getAmount(),
            'invoices_count' => (int) ($pur->cnt ?? 0),
            'returns_count' => (int) ($ret->cnt ?? 0),
        ];
    }

    private function fetchTopSuppliers(?string $fromDate, ?string $toDate, ?int $branchId): array
    {
        $rows = $this->scopedInvoicesQuery(InvoiceType::PURCHASE->value, $fromDate, $toDate, $branchId)
            ->join('parties', 'parties.id', '=', 'invoices.party_id')
            ->selectRaw('invoices.party_id, parties.name as supplier_name, parties.phone as supplier_phone, parties.balance as current_balance, COUNT(*) as invoices_count, COALESCE(SUM(invoices.total), 0) as total_amount, COALESCE(SUM(invoices.paid_amount), 0) as paid_amount, COALESCE(SUM(invoices.remaining_amount), 0) as remaining_amount')
            ->groupBy('invoices.party_id', 'parties.name', 'parties.phone', 'parties.balance')
            ->orderByDesc('total_amount')->limit(15)->get();

        return $rows->map(fn ($r) => [
            'party_id' => (int) $r->party_id,
            'supplier_name' => $r->supplier_name,
            'supplier_phone' => $r->supplier_phone,
            'invoices_count' => (int) $r->invoices_count,
            'total_amount' => Money::of($r->total_amount ?? 0)->getAmount(),
            'paid_amount' => Money::of($r->paid_amount ?? 0)->getAmount(),
            'remaining_amount' => Money::of($r->remaining_amount ?? 0)->getAmount(),
            'current_balance' => Money::of($r->current_balance ?? 0)->getAmount(),
        ])->values()->all();
    }

    private function fetchTopPurchasedProducts(?string $fromDate, ?string $toDate, ?int $branchId): array
    {
        $query = InvoiceItem::query()
            ->join('invoices', 'invoices.id', '=', 'invoice_items.invoice_id')
            ->where('invoices.type', InvoiceType::PURCHASE->value)->whereNull('invoices.deleted_at');

        if ($fromDate) {
            $query->where('invoices.date', '>=', $fromDate);
        }
        if ($toDate) {
            $query->where('invoices.date', '<=', $toDate . ' 23:59:59');
        }
        if ($branchId) {
            $query->where('invoices.branch_id', $branchId);
        }

        $rows = $query->selectRaw('invoice_items.product_id, invoice_items.product_name, COUNT(DISTINCT invoices.id) as invoices_count, COALESCE(SUM(invoice_items.quantity), 0) as total_quantity, COALESCE(SUM(invoice_items.total), 0) as total_cost')
            ->groupBy('invoice_items.product_id', 'invoice_items.product_name')->orderByDesc('total_cost')->limit(15)->get();

        return $rows->map(function ($r) {
            $qty = Quantity::of($r->total_quantity ?? 0)->toFloat();
            $cost = Money::of($r->total_cost ?? 0);

            return [
                'product_id' => (int) $r->product_id, 'product_name' => $r->product_name, 'invoices_count' => (int) $r->invoices_count,
                'total_quantity' => $qty, 'total_cost' => $cost->getAmount(),
                'avg_unit_cost' => $qty > 0 ? $cost->divide($qty)->getAmount() : 0,
            ];
        })->values()->all();
    }

    private function scopedInvoicesQuery(string $type, ?string $fromDate, ?string $toDate, ?int $branchId)
    {
        $query = Invoice::where('invoices.type', $type);
        if ($fromDate) {
            $query->where('invoices.date', '>=', $fromDate);
        }
        if ($toDate) {
            $query->where('invoices.date', '<=', $toDate . ' 23:59:59');
        }
        if ($branchId) {
            $query->where('invoices.branch_id', $branchId);
        }

        return $query;
    }
}
