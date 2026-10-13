<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CourierService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourierController extends Controller
{
    public function __construct(
        protected CourierService $courierService
    ) {}

    /**
     * قائمة شركات الشحن مع الإحصائيات التشغيلية والمالية
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $search = $request->input('search');

        $result = $this->courierService->getCouriersWithMetrics($user, $search);

        return response()->json([
            'success' => true,
            'data' => $result['couriers'],
            'summary' => $result['summary'],
        ]);
    }

    /**
     * كشف البوالص والشحنات التفصيلي لشركة الشحن (Manifest)
     */
    public function manifest(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $branchId = $request->filled('branch_id') ? (int) $request->input('branch_id') : null;

        $result = $this->courierService->getCourierManifest($user, $id, $branchId);

        return response()->json([
            'success' => true,
            'courier' => $result['courier'],
            'shipments' => $result['shipments'],
            'metrics' => $result['metrics'],
        ]);
    }

    /**
     * مزامنة وتدقيق حركات الطلبات المسلمة السابقة لشركات الشحن
     */
    public function sync(Request $request): JsonResponse
    {
        $user = $request->user();
        $synced = $this->courierService->syncExistingDeliveredOrders($user);

        return response()->json([
            'success' => true,
            'message' => "تم تدقيق ومزامنة {$synced} شحنة بنجاح وتحديث الأرصدة الدفترية",
            'data' => ['synced_count' => $synced],
        ]);
    }

    /**
     * تصفية صافي مستحقات شركة الشحن واستلام النقدية/التحويل
     */
    public function settleNet(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'amount' => ['nullable', 'numeric', 'min:0.01'],
            'type' => ['nullable', 'in:RECEIPT,PAYMENT'],
            'method' => ['nullable', 'string', 'in:CASH,CARD,INSTAPAY,VODAFONE_CASH,TRANSFER'],
            'notes' => ['nullable', 'string', 'max:500'],
            'idempotency_key' => ['nullable', 'string', 'max:255'],
        ]);

        $result = $this->courierService->settleCourierNet($user, $id, $validated);

        return response()->json([
            'success' => true,
            'message' => 'تمت تصفية مستحقات شركة الشحن وتوريد المبلغ بنجاح',
            'data' => $result,
        ]);
    }
}
