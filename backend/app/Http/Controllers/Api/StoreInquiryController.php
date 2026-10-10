<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StoreInquiry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StoreInquiryController extends Controller
{
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

        $inquiry = StoreInquiry::create([
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'business_type' => $validated['business_type'] ?? null,
            'city' => $validated['city'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'status' => 'NEW',
        ]);

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
        $status = $request->input('status');
        $search = $request->input('search');

        $query = StoreInquiry::query();

        if ($status && in_array($status, ['NEW', 'CONTACTED', 'CONTRACTED', 'CLOSED'])) {
            $query->where('status', $status);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('phone', 'like', "%{$search}%")
                  ->orWhere('business_type', 'like', "%{$search}%");
            });
        }

        $stats = [
            'total' => StoreInquiry::count(),
            'new' => StoreInquiry::where('status', 'NEW')->count(),
            'contacted' => StoreInquiry::where('status', 'CONTACTED')->count(),
            'contracted' => StoreInquiry::where('status', 'CONTRACTED')->count(),
        ];

        $inquiries = $query->latest()->paginate(min((int) $request->input('per_page', 25), 100));

        return response()->json([
            'success' => true,
            'stats' => $stats,
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
    public function update(Request $request, int $id): JsonResponse
    {
        $inquiry = StoreInquiry::findOrFail($id);

        $validated = $request->validate([
            'status' => ['nullable', 'string', 'in:NEW,CONTACTED,CONTRACTED,CLOSED'],
            'admin_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $inquiry->update($validated);

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
        $inquiry = StoreInquiry::findOrFail($id);
        $inquiry->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الطلب بنجاح.',
        ]);
    }
}
