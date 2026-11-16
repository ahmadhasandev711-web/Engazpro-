<?php

namespace App\Services;

use App\Enums\BranchType;
use App\Enums\PartyType;
use App\Enums\ProductType;
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
            $mainBranch = $this->ensureMainBranchAndLinkOwner($owner, $accountId);
            $this->ensureDefaultTreasuriesAndCustomer($owner, $accountId, $mainBranch->id);
            $category = Category::firstOrCreate(['user_id' => $accountId, 'name' => 'عام']);

            if ($createSampleProduct) {
                $this->seedSampleProductIfEmpty($owner, $accountId, $category->id);
            }
        });
    }

    private function ensureMainBranchAndLinkOwner(User $owner, int $accountId): Branch
    {
        $mainBranch = Branch::firstOrCreate(
            ['user_id' => $accountId, 'is_main' => true],
            ['name' => 'الفرع الرئيسي', 'code' => TreasuryType::MAIN->value, 'type' => BranchType::STORE, 'is_active' => true]
        );
        if (!$owner->branch_id) {
            $owner->update(['branch_id' => $mainBranch->id]);
        }

        return $mainBranch;
    }

    private function ensureDefaultTreasuriesAndCustomer(User $owner, int $accountId, int $mainBranchId): void
    {
        Treasury::firstOrCreate(
            ['user_id' => $accountId, 'type' => TreasuryType::MAIN],
            ['name' => 'الخزينة المركزية العامة (الإدارة)', 'branch_id' => null, 'balance' => 0.00, 'is_active' => true, 'notes' => 'الخزينة المركزية لإيداعات ومصروفات المتجر والتحويلات الكبرى']
        );
        Treasury::firstOrCreate(
            ['user_id' => $accountId, 'type' => TreasuryType::CASHIER_DRAWER],
            ['name' => 'درج الكاشير', 'branch_id' => $mainBranchId, 'assigned_user_id' => $owner->id, 'balance' => 0.00, 'is_active' => true, 'notes' => 'درج الكاشير للبيع المباشر وفتح الورديات']
        );
        Party::firstOrCreate(
            ['user_id' => $accountId, 'type' => PartyType::CUSTOMER->value, 'name' => 'عميل نقدي عام'],
            ['phone' => null, 'balance' => 0.00, 'notes' => 'العميل الافتراضي لفواتير البيع السريع ونقاط البيع (POS)']
        );
    }

    private function seedSampleProductIfEmpty(User $owner, int $accountId, int $categoryId): void
    {
        if (Product::withoutGlobalScopes()->where('user_id', $accountId)->whereNull('deleted_at')->exists()) {
            return;
        }
        $barcodes = $this->barcodeService->generateUniqueBarcodes($owner, 3);
        $this->productService->createProduct($owner, [
            'name' => 'تيشيرت كاجوال قطن (صنف تجريبي)', 'code' => 'DEMO-TSHIRT',
            'type' => ProductType::VARIABLE->value, 'purchase_price' => 120, 'sale_price' => 220,
            'unit' => 'قطعة', 'category_id' => $categoryId,
            'notes' => 'صنف تجريبي استرشادي جاهز لتجربة الطباعة والبيع السريع في الكاشير',
            'variants' => [
                ['name' => 'أسود / M', 'color' => 'أسود', 'size' => 'M', 'barcode' => $barcodes[0] ?? '', 'purchase_price' => 120, 'sale_price' => 220, 'quantity' => 10, 'min_quantity' => 2],
                ['name' => 'أسود / L', 'color' => 'أسود', 'size' => 'L', 'barcode' => $barcodes[1] ?? '', 'purchase_price' => 120, 'sale_price' => 220, 'quantity' => 15, 'min_quantity' => 3],
                ['name' => 'أبيض / L', 'color' => 'أبيض', 'size' => 'L', 'barcode' => $barcodes[2] ?? '', 'purchase_price' => 120, 'sale_price' => 220, 'quantity' => 8, 'min_quantity' => 2],
            ],
        ]);
    }
}
