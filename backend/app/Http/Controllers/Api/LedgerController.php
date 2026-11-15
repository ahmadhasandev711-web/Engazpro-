<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
        $statement = $this->ledgerService->getStatementForPartyId($request->user(), $partyId, $request->all());

        return response()->json([
            'data' => $statement,
        ]);
    }
}
