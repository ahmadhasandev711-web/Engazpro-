<?php

namespace App\Services;

use App\Models\Category;
use App\Models\Party;
use App\Models\Product;
use App\Models\User;
use Exception;
use Illuminate\Support\Facades\DB;

class ImportService
{
    protected StockService $stockService;

    public function __construct(StockService $stockService)
    {
        $this->stockService = $stockService;
    }

    /**
     * تطبيع وتوحيد أسماء الأعمدة لتسهيل قراءة الملفات سواء بالعربية أو الإنجليزية
     */
    public function normalizeProductRow(array $row): array
    {
        $normalized = [];
        $map = [
            'name' => ['name', 'اسم', 'الاسم', 'اسم الصنف', 'اسم_الصنف', 'الصنف', 'product_name'],
            'category_name' => ['category', 'category_name', 'التصنيف', 'القسم', 'المجموعة', 'تصنيف', 'قسم'],
            'code' => ['code', 'الكود', 'كود', 'كود الصنف', 'كود_الصنف', 'product_code'],
            'barcode' => ['barcode', 'الباركود', 'باركود', 'بار كود'],
            'unit' => ['unit', 'الوحدة', 'وحدة', 'التمييز'],
            'purchase_price' => ['purchase_price', 'سعر الشراء', 'سعر_الشراء', 'شراء', 'سعر_شراء', 'تكلفة'],
            'sale_price' => ['sale_price', 'سعر البيع', 'سعر_البيع', 'بيع', 'سعر_بيع', 'قطاعي'],
            'min_sale_price' => ['min_sale_price', 'أقل سعر بيع', 'اقل سعر بيع', 'اقل_سعر', 'أقل_سعر', 'جملة', 'سعر_جملة'],
            'quantity' => ['quantity', 'الكمية', 'كمية', 'الرصيد', 'رصيد', 'الرصيد الافتتاحي', 'الرصيد_الافتتاحي', 'qty'],
            'min_quantity' => ['min_quantity', 'حد الطلب', 'حد_الطلب', 'الحد الادنى', 'الحد الأدنى', 'الحد_الادنى', 'الحد_الأدنى'],
            'notes' => ['notes', 'ملاحظات', 'الملاحظات', 'ملاحظة', 'وصف'],
        ];

        foreach ($map as $key => $aliases) {
            $value = null;
            foreach ($aliases as $alias) {
                if (array_key_exists($alias, $row) && $row[$alias] !== null && $row[$alias] !== '') {
                    $value = $row[$alias];
                    break;
                }
            }
            $normalized[$key] = $value;
        }

        return $normalized;
    }

    /**
     * معاينة وفحص بيانات استيراد الأصناف قبل الحفظ
     */
    public function previewProducts(User $user, array $rawRows): array
    {
        $previewRows = [];
        $validCount = 0;
        $invalidCount = 0;
        $duplicateCount = 0;

        $accountId = $user->getAccountId();

        // تجميع المنتجات الموجودة للمستخدم لفحص التكرار بسرعة
        $existingProducts = Product::where('user_id', $accountId)
            ->get(['id', 'name', 'code', 'barcode', 'quantity', 'purchase_price', 'sale_price']);

        $existingCodes = $existingProducts->whereNotNull('code')->pluck('id', 'code')->toArray();
        $existingBarcodes = $existingProducts->whereNotNull('barcode')->pluck('id', 'barcode')->toArray();
        $existingNames = $existingProducts->pluck('id', 'name')->toArray();

        $seenInBatchCodes = [];
        $seenInBatchBarcodes = [];
        $seenInBatchNames = [];

        foreach ($rawRows as $index => $rawRow) {
            $rowNum = $index + 1;
            $row = $this->normalizeProductRow($rawRow);

            $errors = [];
            $status = 'VALID';
            $duplicateInfo = null;

            // 1. التحقق من الحقول الإلزامية
            $name = trim((string)($row['name'] ?? ''));
            if ($name === '') {
                $errors[] = 'اسم الصنف مطلوب.';
            }

            $purchasePrice = $row['purchase_price'];
            if ($purchasePrice === null || $purchasePrice === '' || !is_numeric($purchasePrice) || (float)$purchasePrice < 0) {
                $errors[] = 'سعر الشراء غير صالح أو مفقود (يجب أن يكون رقماً أكبر من أو يساوي صفر).';
            }

            $salePrice = $row['sale_price'];
            if ($salePrice === null || $salePrice === '' || !is_numeric($salePrice) || (float)$salePrice < 0) {
                $errors[] = 'سعر البيع غير صالح أو مفقود (يجب أن يكون رقماً أكبر من أو يساوي صفر).';
            }

            $minSalePrice = $row['min_sale_price'];
            if ($minSalePrice !== null && (!is_numeric($minSalePrice) || (float)$minSalePrice < 0)) {
                $errors[] = 'أقل سعر بيع يجب أن يكون رقماً غير سالب.';
            }

            $quantity = $row['quantity'] ?? 0;
            if ($quantity !== null && (!is_numeric($quantity) || (float)$quantity < 0)) {
                $errors[] = 'الكمية الافتتاحية يجب أن تكون رقماً غير سالب.';
            }

            $minQuantity = $row['min_quantity'];
            if ($minQuantity !== null && (!is_numeric($minQuantity) || (float)$minQuantity < 0)) {
                $errors[] = 'الحد الأدنى للكمية يجب أن يكون رقماً غير سالب.';
            }

            $code = !empty($row['code']) ? trim((string)$row['code']) : null;
            $barcode = !empty($row['barcode']) ? trim((string)$row['barcode']) : null;

            // 2. إذا وُجدت أخطاء تنسيق أساسية
            if (!empty($errors)) {
                $status = 'INVALID';
                $invalidCount++;
            } else {
                // 3. التحقق من التكرار داخل نفس الملف
                $isBatchDuplicate = false;
                if ($code && isset($seenInBatchCodes[$code])) {
                    $errors[] = "الكود '{$code}' مكرر داخل نفس الملف في السطر " . $seenInBatchCodes[$code];
                    $isBatchDuplicate = true;
                }
                if ($barcode && isset($seenInBatchBarcodes[$barcode])) {
                    $errors[] = "الباركود '{$barcode}' مكرر داخل نفس الملف في السطر " . $seenInBatchBarcodes[$barcode];
                    $isBatchDuplicate = true;
                }
                if (isset($seenInBatchNames[mb_strtolower($name)])) {
                    $errors[] = "اسم الصنف '{$name}' مكرر داخل نفس الملف في السطر " . $seenInBatchNames[mb_strtolower($name)];
                    $isBatchDuplicate = true;
                }

                if ($isBatchDuplicate) {
                    $status = 'DUPLICATE_IN_FILE';
                    $duplicateCount++;
                } else {
                    // 4. التحقق من التكرار مع قاعدة البيانات
                    $matchedId = null;
                    $matchedReason = '';

                    if ($code && isset($existingCodes[$code])) {
                        $matchedId = $existingCodes[$code];
                        $matchedReason = "مطابق للكود '{$code}' المسجل مسبقاً";
                    } elseif ($barcode && isset($existingBarcodes[$barcode])) {
                        $matchedId = $existingBarcodes[$barcode];
                        $matchedReason = "مطابق للباركود '{$barcode}' المسجل مسبقاً";
                    } elseif (isset($existingNames[$name])) {
                        $matchedId = $existingNames[$name];
                        $matchedReason = "مطابق للاسم '{$name}' المسجل مسبقاً";
                    }

                    if ($matchedId) {
                        $status = 'DUPLICATE';
                        $duplicateCount++;
                        $existingProd = $existingProducts->firstWhere('id', $matchedId);
                        $duplicateInfo = [
                            'existing_id' => $matchedId,
                            'reason' => $matchedReason,
                            'existing_name' => $existingProd->name ?? '',
                            'existing_quantity' => (float)($existingProd->quantity ?? 0),
                            'existing_purchase_price' => (float)($existingProd->purchase_price ?? 0),
                            'existing_sale_price' => (float)($existingProd->sale_price ?? 0),
                        ];
                    } else {
                        $validCount++;
                    }

                    // تسجيل في قائمة الدفعة الحالية
                    if ($code) $seenInBatchCodes[$code] = $rowNum;
                    if ($barcode) $seenInBatchBarcodes[$barcode] = $rowNum;
                    $seenInBatchNames[mb_strtolower($name)] = $rowNum;
                }
            }

            $previewRows[] = [
                'row_number' => $rowNum,
                'status' => $status,
                'errors' => $errors,
                'data' => [
                    'name' => $name,
                    'category_name' => $row['category_name'] ? trim((string)$row['category_name']) : null,
                    'code' => $code,
                    'barcode' => $barcode,
                    'unit' => $row['unit'] ? trim((string)$row['unit']) : 'قطعة',
                    'purchase_price' => is_numeric($purchasePrice) ? (float)$purchasePrice : null,
                    'sale_price' => is_numeric($salePrice) ? (float)$salePrice : null,
                    'min_sale_price' => is_numeric($minSalePrice) ? (float)$minSalePrice : null,
                    'quantity' => is_numeric($quantity) ? (float)$quantity : 0,
                    'min_quantity' => is_numeric($minQuantity) ? (float)$minQuantity : null,
                    'notes' => $row['notes'] ? trim((string)$row['notes']) : null,
                ],
                'duplicate_info' => $duplicateInfo,
            ];
        }

        return [
            'total_rows' => count($rawRows),
            'valid_count' => $validCount,
            'duplicate_count' => $duplicateCount,
            'invalid_count' => $invalidCount,
            'rows' => $previewRows,
        ];
    }

    /**
     * اعتماد وحفظ استيراد الأصناف في قاعدة البيانات داخل Database Transaction
     * @param string $duplicateAction 'skip' أو 'update'
     */
    public function commitProducts(User $user, array $rows, string $duplicateAction = 'skip'): array
    {
        $accountId = $user->getAccountId();

        return DB::transaction(function () use ($user, $accountId, $rows, $duplicateAction) {
            $createdCount = 0;
            $updatedCount = 0;
            $skippedCount = 0;
            $errors = [];

            // كاش للتصنيفات لتقليل استعلامات قاعدة البيانات
            $categoriesCache = Category::where('user_id', $accountId)
                ->pluck('id', 'name')
                ->toArray();

            foreach ($rows as $index => $rowItem) {
                $rowNum = $rowItem['row_number'] ?? ($index + 1);
                $data = $rowItem['data'] ?? $this->normalizeProductRow($rowItem);

                $name = trim((string)($data['name'] ?? ''));
                $purchasePrice = $data['purchase_price'] ?? null;
                $salePrice = $data['sale_price'] ?? null;

                if ($name === '' || !is_numeric($purchasePrice) || !is_numeric($salePrice)) {
                    $skippedCount++;
                    $errors[] = "السطر {$rowNum}: تم تجاهله لعدم اكتمال البيانات الأساسية.";
                    continue;
                }

                $code = !empty($data['code']) ? trim((string)$data['code']) : null;
                $barcode = !empty($data['barcode']) ? trim((string)$data['barcode']) : null;
                $categoryName = !empty($data['category_name']) ? trim((string)$data['category_name']) : null;

                // التعامل مع التصنيف (إنشاء فوري إن لم يكن موجوداً)
                $categoryId = null;
                if ($categoryName) {
                    if (isset($categoriesCache[$categoryName])) {
                        $categoryId = $categoriesCache[$categoryName];
                    } else {
                        $category = Category::firstOrCreate(
                            ['user_id' => $accountId, 'name' => $categoryName]
                        );
                        $categoriesCache[$categoryName] = $category->id;
                        $categoryId = $category->id;
                    }
                }

                // البحث عن المنتج للتحقق من وجوده مسبقاً
                $existingQuery = Product::where('user_id', $accountId);
                $existingProduct = $existingQuery->where(function ($q) use ($code, $barcode, $name) {
                    if ($code) {
                        $q->orWhere('code', $code);
                    }
                    if ($barcode) {
                        $q->orWhere('barcode', $barcode);
                    }
                    $q->orWhere('name', $name);
                })->first();

                $quantityToAdd = is_numeric($data['quantity'] ?? null) ? (float)$data['quantity'] : 0;

                if ($existingProduct) {
                    if ($duplicateAction === 'skip') {
                        $skippedCount++;
                        continue;
                    }

                    // تحديث الصنف الحالي
                    $existingProduct->category_id = $categoryId ?? $existingProduct->category_id;
                    if ($code) $existingProduct->code = $code;
                    if ($barcode) $existingProduct->barcode = $barcode;
                    $existingProduct->purchase_price = (float)$purchasePrice;
                    $existingProduct->sale_price = (float)$salePrice;
                    if (isset($data['min_sale_price']) && is_numeric($data['min_sale_price'])) {
                        $existingProduct->min_sale_price = (float)$data['min_sale_price'];
                    }
                    if (isset($data['min_quantity']) && is_numeric($data['min_quantity'])) {
                        $existingProduct->min_quantity = (float)$data['min_quantity'];
                    }
                    if (!empty($data['unit'])) {
                        $existingProduct->unit = $data['unit'];
                    }
                    if (!empty($data['notes'])) {
                        $existingProduct->notes = $data['notes'];
                    }
                    $existingProduct->save();

                    // إضافة رصيد جديد للمخزون إذا كانت الكمية أكبر من صفر
                    if ($quantityToAdd > 0) {
                        $this->stockService->recordMovement(
                            $user,
                            $existingProduct,
                            'IN',
                            'INITIAL',
                            null,
                            $quantityToAdd,
                            (float)$purchasePrice,
                            'تحديث رصيد عبر استيراد Excel'
                        );
                    }

                    $updatedCount++;
                } else {
                    // إنشاء صنف جديد برصيد أولي 0
                    $product = Product::create([
                        'user_id' => $accountId,
                        'category_id' => $categoryId,
                        'code' => $code,
                        'barcode' => $barcode,
                        'name' => $name,
                        'unit' => !empty($data['unit']) ? $data['unit'] : 'قطعة',
                        'purchase_price' => (float)$purchasePrice,
                        'sale_price' => (float)$salePrice,
                        'min_sale_price' => (isset($data['min_sale_price']) && is_numeric($data['min_sale_price'])) ? (float)$data['min_sale_price'] : null,
                        'quantity' => 0,
                        'min_quantity' => (isset($data['min_quantity']) && is_numeric($data['min_quantity'])) ? (float)$data['min_quantity'] : null,
                        'notes' => $data['notes'] ?? null,
                    ]);

                    // توثيق حركة المخزون الافتتاحية إن وُجدت كمية
                    if ($quantityToAdd > 0) {
                        $this->stockService->recordMovement(
                            $user,
                            $product,
                            'IN',
                            'INITIAL',
                            null,
                            $quantityToAdd,
                            (float)$purchasePrice,
                            'رصيد افتتاحي عبر استيراد Excel'
                        );
                    }

                    $createdCount++;
                }
            }

            return [
                'success' => true,
                'created_count' => $createdCount,
                'updated_count' => $updatedCount,
                'skipped_count' => $skippedCount,
                'errors' => $errors,
                'message' => "تم الاستيراد بنجاح: تم إنشاء {$createdCount} صنف، تحديث {$updatedCount}، وتخطي {$skippedCount}.",
            ];
        });
    }

    /**
     * قوالب الاستيراد الجاهزة للتحميل
     */
    public function getProductsTemplateHeaders(): array
    {
        return [
            ['اسم الصنف', 'التصنيف', 'الكود', 'الباركود', 'الوحدة', 'سعر الشراء', 'سعر البيع', 'أقل سعر بيع', 'الرصيد الافتتاحي', 'حد الطلب', 'ملاحظات'],
            ['بيبسي كانز 330مل', 'مشروبات غازية', 'BEV-001', '6221234567890', 'قطعة', 12.50, 15.00, 14.00, 50, 10, 'مشروبات باردة'],
            ['شيبسي عائلي جبنة', 'سناكس', 'SNK-002', '6229876543210', 'قطعة', 8.00, 10.00, 9.50, 100, 20, ''],
        ];
    }
}
