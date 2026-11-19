<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\InvoiceRequest;
use App\Http\Requests\UpdateInvoiceSalespersonRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Services\InvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class InvoiceController extends Controller
{
    public function __construct(
        protected InvoiceService $invoiceService
    ) {}

    /**
     * قائمة الفواتير مع التصفية والبحث
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->all();
        $invoices = $this->invoiceService->getInvoicesPaginated($request->user(), $filters);
        $summary = $this->invoiceService->getInvoicesSummary($request->user(), $filters);

        return response()->json([
            'success' => true,
            'data' => InvoiceResource::collection($invoices),
            'summary' => $summary,
            'meta' => [
                'current_page' => $invoices->currentPage(),
                'last_page' => $invoices->lastPage(),
                'per_page' => $invoices->perPage(),
                'total' => $invoices->total(),
            ],
        ]);
    }

    /**
     * إنشاء فاتورة جديدة
     */
    public function store(InvoiceRequest $request): JsonResponse
    {
        Gate::authorize('create', [Invoice::class, $request->input('type')]);

        $invoice = $this->invoiceService->createInvoice($request->user(), $request->validated());

        return response()->json([
            'success' => true,
            'message' => 'تم حفظ الفاتورة بنجاح',
            'data' => new InvoiceResource($invoice),
        ], 201);
    }

    /**
     * عرض تفاصيل فاتورة
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $invoice = $this->invoiceService->findForShowOrFail($id);

        Gate::authorize('view', $invoice);

        return response()->json([
            'success' => true,
            'data' => new InvoiceResource($invoice),
        ]);
    }

    /**
     * البحث عن فاتورة برقمها مع بنودها (لعمل مرتجع)
     */
    public function findByNumber(Request $request, string $invoiceNumber): JsonResponse
    {
        $returnType = $request->query('return_type');
        $invoice = $this->invoiceService->findByNumberForUser(
            $request->user(),
            $invoiceNumber,
            is_string($returnType) ? $returnType : null
        );

        if (!$invoice) {
            return response()->json([
                'success' => false,
                'message' => 'لم يتم العثور على فاتورة بهذا الرقم',
            ], 404);
        }

        Gate::authorize($request->boolean('for_return') ? 'viewForReturn' : 'view', $invoice);

        return response()->json([
            'success' => true,
            'data' => new InvoiceResource($invoice),
        ]);
    }

    /**
     * تعديل مسؤول المبيعات في الفاتورة (متاح للمالك والإدارة ومدير الفرع)
     */
    public function updateSalesperson(UpdateInvoiceSalespersonRequest $request, int $id): JsonResponse
    {
        $invoice = $this->invoiceService->findOrFail($id);

        Gate::authorize('updateSalesperson', $invoice);

        $salespersonId = $request->validated()['salesperson_id'] ?? null;
        $updated = $this->invoiceService->updateSalesperson($invoice, $salespersonId !== null ? (int) $salespersonId : null);

        return response()->json([
            'success' => true,
            'message' => 'تم تعديل مسؤول المبيعات في الفاتورة بنجاح',
            'data' => new InvoiceResource($updated),
        ]);
    }

    /**
     * حذف فاتورة وإلغاؤها (Rollback / Reversal)
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $invoice = $this->invoiceService->findOrFail($id);

        Gate::authorize('delete', $invoice);

        $this->invoiceService->deleteInvoice($request->user(), $id);

        return response()->json([
            'success' => true,
            'message' => 'تم إلغاء الفاتورة بنجاح والتراجع عن الحركات المتعلقة بها',
        ]);
    }
}
