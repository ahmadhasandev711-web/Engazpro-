<?php

namespace App\Services\Exchange;

use App\Models\Exchange;
use App\Models\Party;
use App\Models\User;
use App\Services\BranchScopeService;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class ExchangeQueryService
{
    public function __construct(
        private readonly BranchScopeService $branchScopeService
    ) {}

    public function paginateForUser(User $user, array $filters = []): LengthAwarePaginator
    {
        $query = Exchange::where('user_id', $user->getAccountId())
            ->with([
                'party:id,name,phone',
                'branch:id,name',
                'originalInvoice:id,invoice_number',
                'originalOnlineOrder:id,external_order_number',
                'replacementOnlineOrder:id,external_order_number,status',
            ])
            ->latest('id');

        $this->branchScopeService->applyBranchFilter(
            $query,
            $user,
            'branch_id',
            !empty($filters['branch_id']) ? (int) $filters['branch_id'] : null
        );
        $this->applyFilters($query, $filters);

        $perPage = max(1, min((int) ($filters['per_page'] ?? 20), 100));

        return $query->paginate($perPage);
    }

    private function applyFilters(Builder $query, array $filters): void
    {
        if (!empty($filters['source'])) {
            $query->where('source', $filters['source']);
        }
        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (!empty($filters['date_from'])) {
            $query->where('created_at', '>=', Carbon::parse($filters['date_from'])->startOfDay());
        }
        if (!empty($filters['date_to'])) {
            $query->where('created_at', '<=', Carbon::parse($filters['date_to'])->endOfDay());
        }
        if (!empty($filters['search'])) {
            $q = trim((string) $filters['search']);
            $query->where(fn (Builder $sub) => $sub->where('exchange_number', 'like', "%{$q}%")
                ->orWhereHas('party', fn (Builder $pq) => $pq->where('name', 'like', "%{$q}%")->orWhere('phone', 'like', "%{$q}%"))
                ->orWhereHas('originalInvoice', fn (Builder $iq) => $iq->where('invoice_number', 'like', "%{$q}%")));
        }
    }

    public function findForShowOrFail(User $user, int $id): Exchange
    {
        $exchange = Exchange::where('user_id', $user->getAccountId())
            ->with([
                'items',
                'party',
                'branch:id,name',
                'creator:id,name',
                'salesperson:id,name',
                'originalInvoice',
                'returnInvoice.items',
                'replacementInvoice.items',
                'originalOnlineOrder',
                'replacementOnlineOrder',
            ])
            ->findOrFail($id);

        if ($exchange->branch_id !== null) {
            $this->branchScopeService->assertCanAccessBranch($user, $exchange->branch_id, 'عذراً، لا تملك صلاحية عرض عمليات الاستبدال لفرع آخر.');
        }

        return $exchange;
    }

    public function findScopedPartyOrFail(User $user, int $partyId): Party
    {
        return Party::where('user_id', $user->getAccountId())->findOrFail($partyId);
    }
}
