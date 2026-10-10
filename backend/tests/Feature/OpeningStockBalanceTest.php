<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockMovement;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OpeningStockBalanceTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $otherOwner;
    protected Branch $branch;
    protected string $ownerToken;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'صاحب المتجر',
            'phone' => '01000000001',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER->value,
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ENTERPRISE',
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'BR-01',
            'is_active' => true,
        ]);

        $this->ownerToken = $this->owner->createToken('owner_token')->plainTextToken;

        // Second store for multi-tenancy testing
        $this->otherOwner = User::create([
            'name' => 'تاجر آخر',
            'phone' => '01000000009',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER->value,
        ]);

        Subscription::create([
            'user_id' => $this->otherOwner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ENTERPRISE',
        ]);
    }

    public function test_can_record_opening_balance_for_simple_product(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'قميص أبيض قياسي',
            'code' => 'SHIRT-01',
            'barcode' => '6221234567890',
            'purchase_price' => 0,
            'sale_price' => 250,
            'quantity' => 0,
            'unit' => 'قطعة',
            'type' => 'STANDARD',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $this->ownerToken)
            ->postJson('/api/products/opening-balance', [
                'branch_id' => $this->branch->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'product_variant_id' => null,
                        'quantity' => 45,
                        'cost_price' => 135.50,
                    ],
                ],
            ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.updated_count', 1);

        // Verify product stock & cost price updated
        $product->refresh();
        $this->assertEquals(45, (float) $product->quantity);
        $this->assertEquals(135.50, (float) $product->purchase_price);

        // Verify BranchStock
        $branchStock = BranchStock::where('branch_id', $this->branch->id)
            ->where('product_id', $product->id)
            ->whereNull('product_variant_id')
            ->first();
        $this->assertNotNull($branchStock);
        $this->assertEquals(45, (float) $branchStock->quantity);

        // Verify StockMovement audit
        $movement = StockMovement::where('product_id', $product->id)->first();
        $this->assertNotNull($movement);
        $this->assertEquals('IN', $movement->type);
        $this->assertEquals('INITIAL', $movement->source_type);
        $this->assertEquals(45, (float) $movement->quantity);
        $this->assertEquals(135.50, (float) $movement->unit_price);
        $this->assertStringContainsString('رصيد أول المدة', $movement->notes);
    }

    public function test_can_record_opening_balance_for_variable_product(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'بنطلون جينز كاجوال',
            'code' => 'JEANS-01',
            'purchase_price' => 0,
            'sale_price' => 400,
            'quantity' => 0,
            'unit' => 'قطعة',
            'type' => 'VARIABLE',
        ]);

        $v1 = ProductVariant::create([
            'product_id' => $product->id,
            'user_id' => $this->owner->id,
            'name' => 'أزرق / مقاس 32',
            'color' => 'أزرق',
            'size' => '32',
            'barcode' => '622000000001',
            'purchase_price' => 0,
            'sale_price' => 400,
            'quantity' => 0,
        ]);

        $v2 = ProductVariant::create([
            'product_id' => $product->id,
            'user_id' => $this->owner->id,
            'name' => 'أسود / مقاس 34',
            'color' => 'أسود',
            'size' => '34',
            'barcode' => '622000000002',
            'purchase_price' => 0,
            'sale_price' => 420,
            'quantity' => 0,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $this->ownerToken)
            ->postJson('/api/products/opening-balance', [
                'branch_id' => $this->branch->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'product_variant_id' => $v1->id,
                        'quantity' => 20,
                        'cost_price' => 220,
                    ],
                    [
                        'product_id' => $product->id,
                        'product_variant_id' => $v2->id,
                        'quantity' => 15,
                        'cost_price' => 230,
                    ],
                ],
            ]);

        $response->assertOk();
        $response->assertJsonPath('data.updated_count', 2);

        $v1->refresh();
        $v2->refresh();
        $product->refresh();

        $this->assertEquals(20, (float) $v1->quantity);
        $this->assertEquals(220, (float) $v1->purchase_price);

        $this->assertEquals(15, (float) $v2->quantity);
        $this->assertEquals(230, (float) $v2->purchase_price);

        // Overall product quantity is cumulative
        $this->assertEquals(35, (float) $product->quantity);

        // BranchStock for variants
        $bs1 = BranchStock::where('branch_id', $this->branch->id)->where('product_variant_id', $v1->id)->first();
        $this->assertNotNull($bs1);
        $this->assertEquals(20, (float) $bs1->quantity);

        $bs2 = BranchStock::where('branch_id', $this->branch->id)->where('product_variant_id', $v2->id)->first();
        $this->assertNotNull($bs2);
        $this->assertEquals(15, (float) $bs2->quantity);
    }

    public function test_tenant_isolation_prevents_opening_balance_on_foreign_products(): void
    {
        $otherBranch = Branch::create([
            'user_id' => $this->otherOwner->id,
            'name' => 'فرع متجر آخر',
            'code' => 'OBR-01',
            'is_active' => true,
        ]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف خاص بمتجري',
            'purchase_price' => 0,
            'sale_price' => 100,
            'quantity' => 0,
            'unit' => 'قطعة',
        ]);

        // Attempt to apply opening stock using another store's branch
        $response = $this->withHeader('Authorization', 'Bearer ' . $this->ownerToken)
            ->postJson('/api/products/opening-balance', [
                'branch_id' => $otherBranch->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity' => 10,
                    ],
                ],
            ]);

        $response->assertNotFound();
    }

    public function test_opening_balance_rejects_negative_or_zero_quantity(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف تجريبي',
            'purchase_price' => 0,
            'sale_price' => 100,
            'quantity' => 0,
            'unit' => 'قطعة',
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $this->ownerToken)
            ->postJson('/api/products/opening-balance', [
                'branch_id' => $this->branch->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity' => 0,
                    ],
                ],
            ]);

        $response->assertStatus(422);
    }
}
