<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\ImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class ImportExportController extends Controller
{
    protected ImportService $importService;

    public function __construct(ImportService $importService)
    {
        $this->importService = $importService;
    }

    /**
     * معاينة بيانات استيراد الأصناف قبل الحفظ
     */
    public function previewProducts(Request $request): JsonResponse
    {
        Gate::authorize('create', Product::class);

        $request->validate([
            'rows' => 'required|array',
            'rows.*' => 'required',
        ]);

        $preview = $this->importService->previewProducts(
            $request->user(),
            $request->input('rows')
        );

        return response()->json([
            'success' => true,
            'data' => $preview,
        ]);
    }

    /**
     * تأكيد واعتماد استيراد الأصناف
     */
    public function commitProducts(Request $request): JsonResponse
    {
        Gate::authorize('create', Product::class);

        $request->validate([
            'rows' => 'required|array',
            'duplicate_action' => 'nullable|string|in:skip,update',
        ]);

        $result = $this->importService->commitProducts(
            $request->user(),
            $request->input('rows'),
            $request->input('duplicate_action', 'skip')
        );

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    /**
     * الحصول على قالب استيراد الأصناف النموذجي
     */
    public function productsTemplate(): JsonResponse
    {
        $template = $this->importService->getProductsTemplateHeaders();

        return response()->json([
            'success' => true,
            'data' => [
                'headers' => $template[0],
                'sample_rows' => array_slice($template, 1),
            ],
        ]);
    }
}
