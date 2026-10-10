<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Party;
use App\Services\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LedgerController extends Controller
{
    public function __construct(
        protected LedgerService $ledgerService
    ) {}

    /**
     * كشف حساب الطرف (عميل أو مورد)
     */
    public function statement(Request $request, int $partyId): JsonResponse
    {
        $user = $request->user();
        $party = Party::where('user_id', $user->getAccountId())->findOrFail($partyId);

        $statement = $this->ledgerService->getStatement($user, $party, $request->all());

        return response()->json([
            'data' => $statement,
        ]);
    }
}
