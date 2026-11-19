<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LedgerService;
use App\Services\PartyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class LedgerController extends Controller
{
    public function __construct(
        protected LedgerService $ledgerService,
        protected PartyService $partyService
    ) {}

    /**
     * كشف حساب الطرف (عميل أو مورد أو شركة شحن)
     */
    public function statement(Request $request, int $partyId): JsonResponse
    {
        $party = $this->partyService->findOrFail($partyId);
        Gate::authorize('viewLedger', $party);
        $statement = $this->ledgerService->getStatement($request->user(), $party, $request->all());

        return response()->json([
            'data' => $statement,
        ]);
    }
}
