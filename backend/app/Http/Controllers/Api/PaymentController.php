<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\Payment;
use App\Services\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class PaymentController extends Controller
{
    public function __construct(
        protected PaymentService $paymentService
    ) {}

    /**
     * قائمة السندات مع التصفية
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->all();
        $payments = $this->paymentService->getPaymentsPaginated($request->user(), $filters);
        $summary = $this->paymentService->getPaymentsSummary($request->user(), $filters);

        return response()->json([
            'success' => true,
            'data' => PaymentResource::collection($payments),
            'summary' => $summary,
            'meta' => [
                'current_page' => $payments->currentPage(),
                'last_page' => $payments->lastPage(),
                'per_page' => $payments->perPage(),
                'total' => $payments->total(),
            ],
        ]);
    }

    /**
     * تسجيل سند قبض أو صرف جديد
     */
    public function store(PaymentRequest $request): JsonResponse
    {
        Gate::authorize('create', Payment::class);

        $payment = $this->paymentService->createPayment($request->user(), $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل السند بنجاح وتحديث الحساب',
            'data' => new PaymentResource($payment),
        ], 201);
    }

    /**
     * تفاصيل السند
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $payment = Payment::with(['party', 'invoice', 'creator'])->findOrFail($id);

        Gate::authorize('view', $payment);

        return response()->json([
            'success' => true,
            'data' => new PaymentResource($payment),
        ]);
    }

    /**
     * إلغاء السند وعكس أثره
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $payment = Payment::findOrFail($id);

        Gate::authorize('delete', $payment);

        $this->paymentService->deletePayment($request->user(), $id);

        return response()->json([
            'success' => true,
            'message' => 'تم إلغاء السند بنجاح والتراجع عن القيد المحاسبي',
        ]);
    }
}
