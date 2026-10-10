<?php

namespace App\Http\Controllers\Api;

use App\Enums\PartyType;
use App\Http\Controllers\Controller;
use App\Http\Requests\PartyRequest;
use App\Http\Resources\PartyResource;
use App\Models\Party;
use App\Services\PartyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class PartyController extends Controller
{
    public function __construct(
        protected PartyService $partyService
    ) {}

    /**
     * قائمة العملاء أو الموردين مع البحث والتصفح
     */
    public function index(Request $request): JsonResponse
    {
        $parties = $this->partyService->getPartiesPaginated($request->user(), $request->all());

        return response()->json([
            'success' => true,
            'data' => PartyResource::collection($parties),
            'meta' => [
                'current_page' => $parties->currentPage(),
                'last_page' => $parties->lastPage(),
                'per_page' => $parties->perPage(),
                'total' => $parties->total(),
            ],
        ]);
    }

    /**
     * إضافة عميل أو مورد جديد
     */
    public function store(PartyRequest $request): JsonResponse
    {
        Gate::authorize('create', Party::class);

        $party = $this->partyService->createParty($request->user(), $request->validated());
        $party->loadExists(['invoices', 'payments']);

        $typeArabic = PartyType::tryFrom($party->type)?->label() ?? 'الطرف';

        return response()->json([
            'success' => true,
            'message' => "تمت إضافة {$typeArabic} بنجاح",
            'data' => new PartyResource($party),
        ], 201);
    }

    /**
     * عرض تفاصيل الطرف مع كشف الحساب
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $party = Party::with(['ledgerEntries' => function ($q) {
            $q->latest()->limit(50);
        }])
        ->withExists(['invoices', 'payments'])
        ->findOrFail($id);

        Gate::authorize('view', $party);

        return response()->json([
            'success' => true,
            'data' => new PartyResource($party),
            'ledger' => $party->ledgerEntries,
        ]);
    }

    /**
     * تعديل بيانات الطرف
     */
    public function update(PartyRequest $request, int $id): JsonResponse
    {
        $party = Party::findOrFail($id);

        Gate::authorize('update', $party);

        $party = $this->partyService->updateParty($party, $request->validated());

        $typeArabic = PartyType::tryFrom($party->type)?->label() ?? 'الطرف';

        return response()->json([
            'success' => true,
            'message' => "تم تعديل بيانات {$typeArabic} بنجاح",
            'data' => new PartyResource($party),
        ]);
    }

    /**
     * حذف الطرف
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $party = Party::findOrFail($id);

        Gate::authorize('delete', $party);

        $this->partyService->deleteParty($party);

        $typeArabic = PartyType::tryFrom($party->type)?->label() ?? 'الطرف';

        return response()->json([
            'success' => true,
            'message' => "تم حذف {$typeArabic} بنجاح",
        ]);
    }
}
