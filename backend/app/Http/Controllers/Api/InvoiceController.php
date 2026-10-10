<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\InvoiceRequest;
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
        $invoices = $this->invoiceService->getInvoicesPaginated($request->user(), $request->all());

        return response()->json([
            'success' => true,
            'data' => InvoiceResource::collection($invoices),
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
        $invoice = Invoice::with(['party', 'items', 'creator', 'salesperson'])->findOrFail($id);

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
        $user = $request->user();
        $invoice = Invoice::where('user_id', $user->getAccountId())
            ->where('invoice_number', $invoiceNumber)
            ->with(['party', 'items', 'creator', 'salesperson'])
            ->first();

        if (!$invoice) {
            return response()->json([
                'success' => false,
                'message' => 'لم يتم العثور على فاتورة بهذا الرقم',
            ], 404);
        }

        Gate::authorize('view', $invoice);

        return response()->json([
            'success' => true,
            'data' => new InvoiceResource($invoice),
        ]);
    }

    /**
     * تعديل مسؤول المبيعات في الفاتورة (متاح للمالك والإدارة ومدير الفرع)
     */
    public function updateSalesperson(Request $request, int $id): JsonResponse
    {
        $invoice = Invoice::findOrFail($id);

        Gate::authorize('updateSalesperson', $invoice);

        $accountId = $request->user()->getAccountId();
        $validated = $request->validate([
            'salesperson_id' => [
                'nullable',
                'integer',
                \Illuminate\Validation\Rule::exists('users', 'id')->where(fn ($q) => $q->where('owner_id', $accountId)->orWhere('id', $accountId)),
            ],
        ]);

        $invoice->update(['salesperson_id' => $validated['salesperson_id'] ?? null]);

        return response()->json([
            'success' => true,
            'message' => 'تم تعديل مسؤول المبيعات في الفاتورة بنجاح',
            'data' => new InvoiceResource($invoice->fresh(['party', 'items', 'creator', 'salesperson'])),
        ]);
    }

    /**
     * حذف فاتورة وإلغاؤها (Rollback / Reversal)
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $invoice = Invoice::findOrFail($id);

        Gate::authorize('delete', $invoice);

        $this->invoiceService->deleteInvoice($request->user(), $id);

        return response()->json([
            'success' => true,
            'message' => 'تم إلغاء الفاتورة بنجاح والتراجع عن الحركات المتعلقة بها',
        ]);
    }
}
