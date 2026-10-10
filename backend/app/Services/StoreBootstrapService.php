<?php

namespace App\Services;

use App\Enums\BranchType;
use App\Enums\TreasuryType;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Party;
use App\Models\Product;
use App\Models\Treasury;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class StoreBootstrapService
{
    public function __construct(
        protected BarcodeService $barcodeService,
        protected ProductService $productService
    ) {}

    /**
     * Bootstrap default branches, treasuries, customers, categories, and sample data for a new merchant.
     */
    public function bootstrapNewStore(User $owner, bool $createSampleProduct = true): void
    {
        DB::transaction(function () use ($owner, $createSampleProduct) {
            $accountId = $owner->getAccountId();

            // 1. الفرع والمخزن الرئيسي الافتراضي
            $mainBranch = Branch::firstOrCreate([
                'user_id' => $accountId,
                'is_main' => true,
            ], [
                'name' => 'الفرع الرئيسي',
                'code' => 'MAIN',
                'type' => BranchType::STORE,
                'is_active' => true,
            ]);

            // ربط حساب التاجر بالفرع الرئيسي
            if (!$owner->branch_id) {
                $owner->branch_id = $mainBranch->id;
                $owner->save();
            }

            // 2. الخزينة المركزية العامة (للإدارة وصاحب العمل ككل)
            Treasury::firstOrCreate([
                'user_id' => $accountId,
                'type' => TreasuryType::MAIN,
            ], [
                'name' => 'الخزينة المركزية العامة (الإدارة)',
                'branch_id' => null,
                'balance' => 0.00,
                'is_active' => true,
                'notes' => 'الخزينة المركزية لإيداعات ومصروفات المتجر والتحويلات الكبرى',
            ]);

            // 3. درج الكاشير للورديات الميدانية والـ POS
            Treasury::firstOrCreate([
                'user_id' => $accountId,
                'type' => TreasuryType::CASHIER_DRAWER,
            ], [
                'name' => 'درج الكاشير',
                'branch_id' => $mainBranch->id,
                'assigned_user_id' => $owner->id,
                'balance' => 0.00,
                'is_active' => true,
                'notes' => 'درج الكاشير للبيع المباشر وفتح الورديات',
            ]);

            // 4. عميل نقدي عام افتراضي لفواتير الكاشير الفورية
            Party::firstOrCreate([
                'user_id' => $accountId,
                'type' => 'CUSTOMER',
                'name' => 'عميل نقدي عام',
            ], [
                'phone' => null,
                'balance' => 0.00,
                'notes' => 'العميل الافتراضي لفواتير البيع السريع ونقاط البيع (POS)',
            ]);

            // 5. تصنيف أصناف افتراضي
            $category = Category::firstOrCreate([
                'user_id' => $accountId,
                'name' => 'عام',
            ]);

            // 6. صنف ملابس استرشادي تجريبي بمقاسات وألوان جاهزة (إذا لم يكن لدى المتجر أي أصناف)
            if ($createSampleProduct) {
                $hasProducts = Product::withoutGlobalScopes()
                    ->where('user_id', $accountId)
                    ->whereNull('deleted_at')
                    ->exists();

                if (!$hasProducts) {
                    $barcodes = $this->barcodeService->generateUniqueBarcodes($owner, 3);

                    $sampleData = [
                        'name' => 'تيشيرت كاجوال قطن (صنف تجريبي)',
                        'code' => 'DEMO-TSHIRT',
                        'type' => 'VARIABLE',
                        'purchase_price' => 120,
                        'sale_price' => 220,
                        'unit' => 'قطعة',
                        'category_id' => $category->id,
                        'notes' => 'صنف تجريبي استرشادي جاهز لتجربة الطباعة والبيع السريع في الكاشير',
                        'variants' => [
                            [
                                'name' => 'أسود / M',
                                'color' => 'أسود',
                                'size' => 'M',
                                'barcode' => $barcodes[0] ?? '',
                                'purchase_price' => 120,
                                'sale_price' => 220,
                                'quantity' => 10,
                                'min_quantity' => 2,
                            ],
                            [
                                'name' => 'أسود / L',
                                'color' => 'أسود',
                                'size' => 'L',
                                'barcode' => $barcodes[1] ?? '',
                                'purchase_price' => 120,
                                'sale_price' => 220,
                                'quantity' => 15,
                                'min_quantity' => 3,
                            ],
                            [
                                'name' => 'أبيض / L',
                                'color' => 'أبيض',
                                'size' => 'L',
                                'barcode' => $barcodes[2] ?? '',
                                'purchase_price' => 120,
                                'sale_price' => 220,
                                'quantity' => 8,
                                'min_quantity' => 2,
                            ],
                        ],
                    ];

                    $this->productService->createProduct($owner, $sampleData);
                }
            }
        });
    }
}
