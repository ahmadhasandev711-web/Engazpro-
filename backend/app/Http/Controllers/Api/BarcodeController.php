<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\BarcodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BarcodeController extends Controller
{
    public function __construct(
        protected BarcodeService $barcodeService
    ) {}

    /**
     * توليد باركود أو قائمة أكواد فريدة للمتجر
     */
    public function generate(Request $request): JsonResponse
    {
        $count = (int) $request->input('count', 1);
        $prefix = $request->input('prefix');

        $barcodes = $this->barcodeService->generateUniqueBarcodes($request->user(), $count, $prefix);

        return response()->json([
            'success' => true,
            'data' => [
                'barcode' => $barcodes[0] ?? '',
                'barcodes' => $barcodes,
            ],
        ]);
    }

    /**
     * التحقق من توفر الباركود وعدم تكراره في المتجر
     */
    public function validateBarcode(Request $request): JsonResponse
    {
        $request->validate([
            'barcode' => ['required', 'string', 'max:100'],
            'ignore_product_id' => ['nullable', 'integer'],
            'ignore_variant_id' => ['nullable', 'integer'],
        ]);

        $barcode = (string) $request->input('barcode');
        $ignoreVariantId = $request->input('ignore_variant_id') ? (int) $request->input('ignore_variant_id') : null;
        $ignoreProductId = $request->input('ignore_product_id') ? (int) $request->input('ignore_product_id') : null;

        $isAvailable = $this->barcodeService->validateUniqueBarcode(
            $request->user(),
            $barcode,
            $ignoreVariantId,
            $ignoreProductId
        );

        return response()->json([
            'success' => true,
            'data' => [
                'barcode' => $barcode,
                'is_available' => $isAvailable,
            ],
        ]);
    }
}
