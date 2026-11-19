<?php

namespace App\Http\Controllers\Api;

use App\Enums\CustomerTier;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePartyInteractionRequest;
use App\Http\Requests\UpdatePartyTierRequest;
use App\Http\Resources\PartyInteractionResource;
use App\Http\Resources\PartyResource;
use App\Models\PartyInteraction;
use App\Services\CrmInteractionService;
use App\Services\PartyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class PartyCrmController extends Controller
{
    public function __construct(
        protected PartyService $partyService,
        protected CrmInteractionService $crmService
    ) {}

    public function show(Request $request, int $partyId): JsonResponse
    {
        $party = $this->partyService->findOrFail($partyId);
        Gate::authorize('view', $party);

        $profile = $this->crmService->getCustomerCrmProfile($request->user(), $party, (int) $request->input('per_page', 20));
        $paginator = $profile['interactions'];

        return response()->json([
            'success' => true,
            'party' => new PartyResource($profile['party']),
            'interactions' => PartyInteractionResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function storeInteraction(StorePartyInteractionRequest $request, int $partyId): JsonResponse
    {
        $party = $this->partyService->findOrFail($partyId);
        Gate::authorize('update', $party);

        $interaction = $this->crmService->addInteraction($request->user(), $party, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل التفاعل في ملف العميل بنجاح',
            'data' => new PartyInteractionResource($interaction),
        ], 201);
    }

    public function destroyInteraction(Request $request, int $partyId, PartyInteraction $interaction): JsonResponse
    {
        $party = $this->partyService->findOrFail($partyId);
        Gate::authorize('update', $party);

        $this->crmService->deleteInteraction($request->user(), $party, $interaction);

        return response()->json([
            'success' => true,
            'message' => 'تم حذف سجل التفاعل بنجاح',
        ]);
    }

    public function updateTier(UpdatePartyTierRequest $request, int $partyId): JsonResponse
    {
        $party = $this->partyService->findOrFail($partyId);
        Gate::authorize('updateTier', $party);

        $tierVal = $request->validated('tier');
        $updated = $this->crmService->updateTierOverride($request->user(), $party, $tierVal ? CustomerTier::from($tierVal) : null);

        return response()->json([
            'success' => true,
            'message' => $tierVal ? 'تم تحديث تصنيف العميل يدوياً بنجاح' : 'تمت إعادة التصنيف إلى الوضع التلقائي',
            'data' => new PartyResource($updated),
        ]);
    }
}
