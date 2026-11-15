<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateStoreInquiryRequest;
use App\Services\StoreInquiryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StoreInquiryController extends Controller
{
    public function __construct(
        protected StoreInquiryService $inquiryService
    ) {}

    /**
     * Submit a store creation inquiry from the public landing page.
     */
    public function submitPublic(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'phone' => ['required', 'string', 'max:50'],
            'business_type' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $inquiry = $this->inquiryService->submitPublicInquiry($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم استلام طلبك بنجاح! سيتواصل معك فريقنا التقني في أقرب وقت لتفاصيل تصميم متجرك.',
            'data' => $inquiry,
        ], 201);
    }

    /**
     * List inquiries for Super Admin.
     */
    public function index(Request $request): JsonResponse
    {
        $result = $this->inquiryService->listWithStats(
            $request->input('status'),
            $request->input('search'),
            (int) $request->input('per_page', 25)
        );
        $inquiries = $result['inquiries'];

        return response()->json([
            'success' => true,
            'stats' => $result['stats'],
            'data' => $inquiries->items(),
            'meta' => [
                'current_page' => $inquiries->currentPage(),
                'last_page' => $inquiries->lastPage(),
                'per_page' => $inquiries->perPage(),
                'total' => $inquiries->total(),
            ],
        ]);
    }

    /**
     * Update inquiry status or admin notes.
     */
    public function update(UpdateStoreInquiryRequest $request, int $id): JsonResponse
    {
        $inquiry = $this->inquiryService->updateInquiry($id, $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث حالة الطلب بنجاح.',
            'data' => $inquiry,
        ]);
    }

    /**
     * Delete an inquiry.
     */
    public function destroy(int $id): JsonResponse
    {
        $this->inquiryService->deleteInquiry($id);

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الطلب بنجاح.',
        ]);
    }
}
