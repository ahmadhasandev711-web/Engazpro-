<?php

namespace App\Services\Exchange;

use App\Enums\InvoiceType;
use App\Models\Invoice;
use App\Models\User;
use App\Services\BranchScopeService;
use App\Services\InvoiceService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

class ExchangeLookupService
{
    public function __construct(
        private readonly InvoiceService $invoiceService,
        private readonly BranchScopeService $branchScopeService
    ) {}

    /**
     * Smart return/exchange invoice lookup separating short invoice codes from customer phone/name searches.
     *
     * @return Collection<int, Invoice>
     */
    public function lookupSaleInvoices(User $user, string $rawQuery): Collection
    {
        $query = trim($rawQuery);
        if ($query === '') {
            return collect();
        }

        if ($this->isInvoiceOrOrderNumberQuery($query)) {
            return $this->lookupByDocumentReference($user, $query);
        }

        if (mb_strlen($query) < 3) {
            return collect();
        }

        return $this->lookupByCustomerPhoneOrName($user, $query);
    }

    private function isInvoiceOrOrderNumberQuery(string $query): bool
    {
        if (str_starts_with($query, '#')) {
            return true;
        }

        return (bool) preg_match('/^(INV-?|0*)\d{1,5}$/i', $query);
    }

    private function lookupByDocumentReference(User $user, string $query): Collection
    {
        if (!str_starts_with($query, '#')) {
            $invoice = $this->invoiceService->findByNumberForUser($user, $query, InvoiceType::SALE_RETURN->value);
            if ($invoice) {
                Gate::forUser($user)->authorize('viewForReturn', $invoice);
                return collect([$invoice]);
            }
        }

        $ref = ltrim($query, '#');
        $orders = $this->baseSaleQuery($user)
            ->whereHas('onlineOrder', fn ($q) => $q->where('external_order_number', 'like', "%{$ref}%"))
            ->limit(10)
            ->get();

        return $this->authorizeAndEnrich($user, $orders);
    }

    private function lookupByCustomerPhoneOrName(User $user, string $query): Collection
    {
        $invoices = $this->baseSaleQuery($user)
            ->where(fn ($q) => $q
                ->whereHas('party', fn ($pq) => $pq->where('phone', 'like', "%{$query}%")->orWhere('phone2', 'like', "%{$query}%")->orWhere('name', 'like', "%{$query}%"))
                ->orWhereHas('onlineOrder', fn ($oq) => $oq->where('customer_phone', 'like', "%{$query}%")->orWhere('customer_name', 'like', "%{$query}%")))
            ->limit(10)
            ->get();

        return $this->authorizeAndEnrich($user, $invoices);
    }

    private function baseSaleQuery(User $user)
    {
        $query = Invoice::where('user_id', $user->getAccountId())
            ->where('type', InvoiceType::SALE->value)
            ->with(['party', 'items', 'creator', 'salesperson', 'onlineOrder:id,external_order_number,customer_phone,customer_name'])
            ->withSum('returnInvoices as returned_total', 'total')
            ->withCount('returnInvoices as returns_count')
            ->latest('id');

        $this->branchScopeService->applyBranchFilter($query, $user, 'branch_id', null);

        return $query;
    }

    private function authorizeAndEnrich(User $user, Collection $invoices): Collection
    {
        return $invoices
            ->filter(fn (Invoice $inv) => Gate::forUser($user)->allows('viewForReturn', $inv))
            ->map(fn (Invoice $inv) => $this->invoiceService->enrichReturnableQuantitiesForUser($user, $inv))
            ->values();
    }
}
