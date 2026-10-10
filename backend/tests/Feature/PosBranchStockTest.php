<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PosBranchStockTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $cashier;
    protected Branch $mainBranch;
    protected Branch $maadiBranch;
    protected string $ownerToken;
    protected string $cashierToken;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Create Owner
        $this->owner = User::create([
            'name' => 'مالك المتجر',
            'phone' => '01000000001',
            'password' => bcrypt('password'),
            'role' => UserRole::OWNER->value,
            'is_admin' => false,
        ]);

        \App\Models\Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->mainBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'MAIN',
            'type' => BranchType::STORE->value,
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->maadiBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع المعادي',
            'code' => 'BR-02',
            'type' => BranchType::STORE->value,
            'is_main' => false,
            'is_active' => true,
        ]);

        $this->owner->branch_id = $this->mainBranch->id;
        $this->owner->save();

        // 2. Create Cashier assigned strictly to Maadi Branch
        $this->cashier = User::create([
            'owner_id' => $this->owner->id,
            'branch_id' => $this->maadiBranch->id,
            'name' => 'كاشير المعادي',
            'phone' => '01000000002',
            'password' => bcrypt('password'),
            'role' => UserRole::CASHIER->value,
            'status' => 'ACTIVE',
        ]);

        $this->ownerToken = $this->owner->createToken('test')->plainTextToken;
        $this->cashierToken = $this->cashier->createToken('test')->plainTextToken;
    }

    public function test_cashier_sees_only_assigned_branch_stock_and_clean_canonical_fields(): void
    {
        $category = Category::create([
            'user_id' => $this->owner->id,
            'name' => 'مشروبات',
        ]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'category_id' => $category->id,
            'name' => 'بيبسي كانز 330مل',
            'code' => 'BEV-001',
            'sale_price' => 15.00,
            'purchase_price' => 10.00,
            'quantity' => 59.00, // Global total: 50 in main, 9 in maadi
        ]);

        // Stock in Main Branch: 50
        BranchStock::create([
            'branch_id' => $this->mainBranch->id,
            'product_id' => $product->id,
            'quantity' => 50.00,
        ]);

        // Stock in Maadi Branch: 9
        BranchStock::create([
            'branch_id' => $this->maadiBranch->id,
            'product_id' => $product->id,
            'quantity' => 9.00,
        ]);

        // Cashier request to /api/products
        $res = $this->withHeader('Authorization', "Bearer {$this->cashierToken}")
            ->getJson('/api/products');

        $res->assertStatus(200)
            ->assertJsonPath('success', true);

        $item = $res->json('data.0');

        // MUST see branch stock (9.00) NOT global total (59.00)
        $this->assertEquals(9.00, $item['quantity']);
        $this->assertEquals(15.00, $item['sale_price']);
        $this->assertEquals('مشروبات', $item['category_name']);

        // MUST NOT have redundant alias fields (Clean Contract adherence)
        $this->assertArrayNotHasKey('retail_price', $item);
        $this->assertArrayNotHasKey('stock_quantity', $item);
        $this->assertArrayNotHasKey('category', $item);
    }

    public function test_owner_can_query_specific_branch_stock_or_global_stock(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'شيبسي عائلي',
            'code' => 'SNK-001',
            'sale_price' => 10.00,
            'purchase_price' => 7.00,
            'quantity' => 109.00,
        ]);

        BranchStock::create([
            'branch_id' => $this->mainBranch->id,
            'product_id' => $product->id,
            'quantity' => 100.00,
        ]);

        BranchStock::create([
            'branch_id' => $this->maadiBranch->id,
            'product_id' => $product->id,
            'quantity' => 9.00,
        ]);

        // 1. Owner queries with branch_id = Maadi Branch
        $resMaadi = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->getJson("/api/products?branch_id={$this->maadiBranch->id}");

        $resMaadi->assertStatus(200);
        $this->assertEquals(9.00, $resMaadi->json('data.0.quantity'));

        // 2. Owner queries with branch_id = Main Branch
        $resMain = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->getJson("/api/products?branch_id={$this->mainBranch->id}");

        $resMain->assertStatus(200);
        $this->assertEquals(100.00, $resMain->json('data.0.quantity'));

        // 3. Owner queries without branch_id (general store overview)
        $resGlobal = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->getJson('/api/products');

        $resGlobal->assertStatus(200);
        $this->assertEquals(109.00, $resGlobal->json('data.0.quantity'));
    }

    public function test_variant_quantities_are_scoped_to_branch(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'قميص أكسفورد',
            'code' => 'SHIRT-01',
            'has_variants' => true,
            'type' => 'VARIABLE',
            'sale_price' => 200.00,
            'quantity' => 30.00,
        ]);

        $variant = ProductVariant::create([
            'user_id' => $this->owner->id,
            'product_id' => $product->id,
            'name' => 'أزرق / L',
            'color' => 'أزرق',
            'size' => 'L',
            'sale_price' => 220.00,
            'quantity' => 30.00,
        ]);

        // Maadi branch has 7 of this variant
        BranchStock::create([
            'branch_id' => $this->maadiBranch->id,
            'product_id' => $product->id,
            'product_variant_id' => $variant->id,
            'quantity' => 7.00,
        ]);

        $res = $this->withHeader('Authorization', "Bearer {$this->cashierToken}")
            ->getJson('/api/products');

        $res->assertStatus(200);
        $varData = $res->json('data.0.variants.0');
        $this->assertEquals(7.00, $varData['quantity']);
        $this->assertEquals(220.00, $varData['sale_price']);
        $this->assertArrayNotHasKey('retail_price', $varData);
        $this->assertArrayNotHasKey('stock_quantity', $varData);
    }
}
