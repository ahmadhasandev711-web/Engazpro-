<?php

namespace App\Services;

use App\Enums\ImportRowStatus;
use App\Enums\StockMovementSource;
use App\Enums\StockMovementType;
use App\Models\Category;
use App\Models\Party;
use App\Models\Product;
use App\Models\User;
use App\Support\Money;
use App\Support\Quantity;
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
        $existing = $this->fetchExistingImportLookup($user->getAccountId());
        $seen = ['codes' => [], 'barcodes' => [], 'names' => []];
        $counts = ['validCount' => 0, 'invalidCount' => 0, 'duplicateCount' => 0];
        $previewRows = [];

        foreach ($rawRows as $index => $rawRow) {
            $result = $this->evaluatePreviewRow($rawRow, $index + 1, $existing, $seen);
            $previewRows[] = $result['row'];
            $counts[$result['bucket']]++;
        }

        return [
            'total_rows' => count($rawRows),
            'valid_count' => $counts['validCount'],
            'duplicate_count' => $counts['duplicateCount'],
            'invalid_count' => $counts['invalidCount'],
            'rows' => $previewRows,
        ];
    }

    private function fetchExistingImportLookup(int $accountId): array
    {
        $products = Product::where('user_id', $accountId)
            ->get(['id', 'name', 'code', 'barcode', 'quantity', 'purchase_price', 'sale_price']);

        return [
            'products' => $products,
            'codes' => $products->whereNotNull('code')->pluck('id', 'code')->toArray(),
            'barcodes' => $products->whereNotNull('barcode')->pluck('id', 'barcode')->toArray(),
            'names' => $products->pluck('id', 'name')->toArray(),
        ];
    }

    private function evaluatePreviewRow(array $rawRow, int $rowNum, array $existing, array &$seen): array
    {
        $row = $this->normalizeProductRow($rawRow);
        $name = trim((string) ($row['name'] ?? ''));
        $code = !empty($row['code']) ? trim((string) $row['code']) : null;
        $barcode = !empty($row['barcode']) ? trim((string) $row['barcode']) : null;
        $errors = $this->validateImportRowFields($row, $name, $barcode);

        [$status, $bucket, $duplicateInfo] = $this->classifyPreviewRow(
            $rowNum, $name, $code, $barcode, $errors, $existing, $seen
        );

        return [
            'bucket' => $bucket,
            'row' => [
                'row_number' => $rowNum,
                'status' => $status,
                'errors' => $errors,
                'data' => $this->formatPreviewRowData($row, $name, $code, $barcode),
                'duplicate_info' => $duplicateInfo,
            ],
        ];
    }

    private function validateImportRowFields(array $row, string $name, ?string $barcode): array
    {
        $errors = $name === '' ? ['اسم الصنف مطلوب.'] : [];
        $purchasePrice = $row['purchase_price'];
        $salePrice = $row['sale_price'];
        if ($purchasePrice === null || $purchasePrice === '' || !is_numeric($purchasePrice) || Money::of($purchasePrice)->isNegative()) {
            $errors[] = 'سعر الشراء غير صالح أو مفقود (يجب أن يكون رقماً أكبر من أو يساوي صفر).';
        }
        if ($salePrice === null || $salePrice === '' || !is_numeric($salePrice) || Money::of($salePrice)->isNegative()) {
            $errors[] = 'سعر البيع غير صالح أو مفقود (يجب أن يكون رقماً أكبر من أو يساوي صفر).';
        }
        if ($row['min_sale_price'] !== null && (!is_numeric($row['min_sale_price']) || Money::of($row['min_sale_price'])->isNegative())) {
            $errors[] = 'أقل سعر بيع يجب أن يكون رقماً غير سالب.';
        }
        $qty = $row['quantity'] ?? 0;
        if ($qty !== null && (!is_numeric($qty) || Quantity::of($qty)->isNegative())) {
            $errors[] = 'الكمية الافتتاحية يجب أن تكون رقماً غير سالب.';
        }
        if ($row['min_quantity'] !== null && (!is_numeric($row['min_quantity']) || Quantity::of($row['min_quantity'])->isNegative())) {
            $errors[] = 'الحد الأدنى للكمية يجب أن يكون رقماً غير سالب.';
        }
        if ($barcode && (!preg_match('/^[ -~]+$/', $barcode) || preg_match('/[<>"\'`]/', $barcode))) {
            $errors[] = "الباركود '{$barcode}' يحتوي على رموز غير مسموحة.";
        }

        return $errors;
    }

    private function classifyPreviewRow(int $rowNum, string $name, ?string $code, ?string $barcode, array &$errors, array $existing, array &$seen): array
    {
        if (!empty($errors)) {
            return [ImportRowStatus::INVALID->value, 'invalidCount', null];
        }
        if ($this->hasBatchImportDuplicate($code, $barcode, $name, $seen, $errors)) {
            return [ImportRowStatus::DUPLICATE_IN_FILE->value, 'duplicateCount', null];
        }
        if ($code) {
            $seen['codes'][$code] = $rowNum;
        }
        if ($barcode) {
            $seen['barcodes'][$barcode] = $rowNum;
        }
        $seen['names'][mb_strtolower($name)] = $rowNum;
        $duplicateInfo = $this->resolveDatabaseDuplicate($code, $barcode, $name, $existing);

        return $duplicateInfo
            ? [ImportRowStatus::DUPLICATE->value, 'duplicateCount', $duplicateInfo]
            : [ImportRowStatus::VALID->value, 'validCount', null];
    }

    private function hasBatchImportDuplicate(?string $code, ?string $barcode, string $name, array $seen, array &$errors): bool
    {
        $isDup = false;
        if ($code && isset($seen['codes'][$code])) {
            $errors[] = "الكود '{$code}' مكرر داخل نفس الملف في السطر " . $seen['codes'][$code];
            $isDup = true;
        }
        if ($barcode && isset($seen['barcodes'][$barcode])) {
            $errors[] = "الباركود '{$barcode}' مكرر داخل نفس الملف في السطر " . $seen['barcodes'][$barcode];
            $isDup = true;
        }
        if (isset($seen['names'][mb_strtolower($name)])) {
            $errors[] = "اسم الصنف '{$name}' مكرر داخل نفس الملف في السطر " . $seen['names'][mb_strtolower($name)];
            $isDup = true;
        }

        return $isDup;
    }

    private function resolveDatabaseDuplicate(?string $code, ?string $barcode, string $name, array $existing): ?array
    {
        $match = match (true) {
            $code && isset($existing['codes'][$code]) => [$existing['codes'][$code], "مطابق للكود '{$code}' المسجل مسبقاً"],
            $barcode && isset($existing['barcodes'][$barcode]) => [$existing['barcodes'][$barcode], "مطابق للباركود '{$barcode}' المسجل مسبقاً"],
            isset($existing['names'][$name]) => [$existing['names'][$name], "مطابق للاسم '{$name}' المسجل مسبقاً"],
            default => null,
        };
        if (!$match) {
            return null;
        }
        $prod = $existing['products']->firstWhere('id', $match[0]);

        return [
            'existing_id' => $match[0], 'reason' => $match[1], 'existing_name' => $prod->name ?? '',
            'existing_quantity' => Quantity::of($prod->quantity ?? 0)->toFloat(),
            'existing_purchase_price' => Money::of($prod->purchase_price ?? 0)->getAmount(),
            'existing_sale_price' => Money::of($prod->sale_price ?? 0)->getAmount(),
        ];
    }

    private function formatPreviewRowData(array $row, string $name, ?string $code, ?string $barcode): array
    {
        $qty = $row['quantity'] ?? 0;

        return [
            'name' => $name,
            'category_name' => $row['category_name'] ? trim((string) $row['category_name']) : null,
            'code' => $code,
            'barcode' => $barcode,
            'unit' => $row['unit'] ? trim((string) $row['unit']) : 'قطعة',
            'purchase_price' => is_numeric($row['purchase_price']) ? Money::of($row['purchase_price'])->getAmount() : null,
            'sale_price' => is_numeric($row['sale_price']) ? Money::of($row['sale_price'])->getAmount() : null,
            'min_sale_price' => is_numeric($row['min_sale_price']) ? Money::of($row['min_sale_price'])->getAmount() : null,
            'quantity' => is_numeric($qty) ? Quantity::of($qty)->toFloat() : 0,
            'min_quantity' => is_numeric($row['min_quantity']) ? Quantity::of($row['min_quantity'])->toFloat() : null,
            'notes' => $row['notes'] ? trim((string) $row['notes']) : null,
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
            $counts = ['created' => 0, 'updated' => 0, 'skipped' => 0];
            $errors = [];
            $categoriesCache = Category::where('user_id', $accountId)->pluck('id', 'name')->toArray();

            foreach ($rows as $index => $rowItem) {
                $this->processImportCommitRow(
                    $user, $accountId, $rowItem, $rowItem['row_number'] ?? ($index + 1),
                    $duplicateAction, $categoriesCache, $counts, $errors
                );
            }

            return [
                'success' => true, 'created_count' => $counts['created'],
                'updated_count' => $counts['updated'], 'skipped_count' => $counts['skipped'], 'errors' => $errors,
                'message' => "تم الاستيراد بنجاح: تم إنشاء {$counts['created']} صنف، تحديث {$counts['updated']}، وتخطي {$counts['skipped']}.",
            ];
        });
    }

    private function processImportCommitRow(User $user, int $accountId, array $rowItem, int $rowNum, string $duplicateAction, array &$categoriesCache, array &$counts, array &$errors): void
    {
        $data = $rowItem['data'] ?? $this->normalizeProductRow($rowItem);
        $name = trim((string) ($data['name'] ?? ''));
        $purchasePrice = $data['purchase_price'] ?? null;
        $salePrice = $data['sale_price'] ?? null;
        if ($name === '' || !is_numeric($purchasePrice) || !is_numeric($salePrice)) {
            $counts['skipped']++;
            $errors[] = "السطر {$rowNum}: تم تجاهله لعدم اكتمال البيانات الأساسية.";
            return;
        }
        $code = !empty($data['code']) ? trim((string) $data['code']) : null;
        $barcode = !empty($data['barcode']) ? trim((string) $data['barcode']) : null;
        $categoryId = $this->resolveImportCategoryId($accountId, !empty($data['category_name']) ? trim((string) $data['category_name']) : null, $categoriesCache);
        $existingProduct = $this->findExistingImportProduct($accountId, $code, $barcode, $name);
        $quantityToAdd = is_numeric($data['quantity'] ?? null) ? Quantity::of($data['quantity'])->toFloat() : 0;

        if ($existingProduct && $duplicateAction === 'skip') {
            $counts['skipped']++;
            return;
        }
        if ($existingProduct) {
            $this->updateExistingImportedProduct($user, $existingProduct, $data, $categoryId, $code, $barcode, $quantityToAdd);
            $counts['updated']++;
        } else {
            $this->createNewImportedProduct($user, $accountId, $data, $name, $categoryId, $code, $barcode, $quantityToAdd);
            $counts['created']++;
        }
    }

    private function resolveImportCategoryId(int $accountId, ?string $categoryName, array &$categoriesCache): ?int
    {
        if (!$categoryName) {
            return null;
        }
        if (!isset($categoriesCache[$categoryName])) {
            $categoriesCache[$categoryName] = Category::firstOrCreate(['user_id' => $accountId, 'name' => $categoryName])->id;
        }

        return $categoriesCache[$categoryName];
    }

    private function findExistingImportProduct(int $accountId, ?string $code, ?string $barcode, string $name): ?Product
    {
        return Product::where('user_id', $accountId)->where(function ($q) use ($code, $barcode, $name) {
            if ($code) {
                $q->orWhere('code', $code);
            }
            if ($barcode) {
                $q->orWhere('barcode', $barcode);
            }
            $q->orWhere('name', $name);
        })->first();
    }

    private function updateExistingImportedProduct(User $user, Product $product, array $data, ?int $categoryId, ?string $code, ?string $barcode, float $quantityToAdd): void
    {
        $product->category_id = $categoryId ?? $product->category_id;
        if ($code) {
            $product->code = $code;
        }
        if ($barcode) {
            $product->barcode = $barcode;
        }
        $product->purchase_price = Money::of($data['purchase_price'])->getAmount();
        $product->sale_price = Money::of($data['sale_price'])->getAmount();
        if (isset($data['min_sale_price']) && is_numeric($data['min_sale_price'])) {
            $product->min_sale_price = Money::of($data['min_sale_price'])->getAmount();
        }
        if (isset($data['min_quantity']) && is_numeric($data['min_quantity'])) {
            $product->min_quantity = Quantity::of($data['min_quantity'])->toFloat();
        }
        $product->unit = !empty($data['unit']) ? $data['unit'] : $product->unit;
        $product->notes = !empty($data['notes']) ? $data['notes'] : $product->notes;
        $product->save();
        $this->recordInitialImportMovement($user, $product, $quantityToAdd, Money::of($data['purchase_price'])->getAmount(), 'تحديث رصيد عبر استيراد Excel');
    }

    private function createNewImportedProduct(User $user, int $accountId, array $data, string $name, ?int $categoryId, ?string $code, ?string $barcode, float $quantityToAdd): void
    {
        $purchaseAmount = Money::of($data['purchase_price'])->getAmount();
        $product = Product::create([
            'user_id' => $accountId, 'category_id' => $categoryId, 'code' => $code, 'barcode' => $barcode, 'name' => $name,
            'unit' => !empty($data['unit']) ? $data['unit'] : 'قطعة',
            'purchase_price' => $purchaseAmount,
            'sale_price' => Money::of($data['sale_price'])->getAmount(),
            'min_sale_price' => (isset($data['min_sale_price']) && is_numeric($data['min_sale_price'])) ? Money::of($data['min_sale_price'])->getAmount() : null,
            'quantity' => 0,
            'min_quantity' => (isset($data['min_quantity']) && is_numeric($data['min_quantity'])) ? Quantity::of($data['min_quantity'])->toFloat() : null,
            'notes' => $data['notes'] ?? null,
        ]);
        $this->recordInitialImportMovement($user, $product, $quantityToAdd, $purchaseAmount, 'رصيد افتتاحي عبر استيراد Excel');
    }

    private function recordInitialImportMovement(User $user, Product $product, float $quantityToAdd, float $purchaseAmount, string $note): void
    {
        if ($quantityToAdd > 0) {
            $this->stockService->recordMovement(
                $user, $product, StockMovementType::IN->value, StockMovementSource::INITIAL->value,
                null, $quantityToAdd, $purchaseAmount, $note
            );
        }
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
