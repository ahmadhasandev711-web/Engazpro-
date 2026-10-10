<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\StockTransferStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\StockTransfer;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MultiBranchAndStockTransferTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected string $token;
    protected Branch $mainBranch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'المالك أحمد',
            'phone' => '01000000001',
            'password' => bcrypt('password123'),
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->mainBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'BR-01',
            'type' => BranchType::STORE,
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->owner->update(['branch_id' => $this->mainBranch->id]);
        $this->token = $this->owner->createToken('test_token')->plainTextToken;
    }

    public function test_can_list_branches_and_create_new_branch(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson('/api/branches');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', 'BR-01');

        // Create new branch
        $createRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/branches', [
                'name' => 'فرع المعادي',
                'code' => 'BR-02',
                'type' => 'STORE',
                'phone' => '01022223333',
                'address' => 'شارع النصر، المعادي',
            ]);

        $createRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'فرع المعادي');

        $this->assertDatabaseHas('branches', [
            'user_id' => $this->owner->id,
            'code' => 'BR-02',
            'name' => 'فرع المعادي',
        ]);
    }

    public function test_can_execute_stock_transfer_lifecycle(): void
    {
        // 1. Create second branch
        $branch2 = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع مدينة نصر',
            'code' => 'BR-02',
            'type' => BranchType::STORE,
            'is_main' => false,
            'is_active' => true,
        ]);

        // 2. Create product with 50 items in main branch
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'قميص أكسفورد أبيض',
            'sale_price' => 250,
            'purchase_price' => 150,
            'quantity' => 50,
        ]);

        BranchStock::create([
            'branch_id' => $this->mainBranch->id,
            'product_id' => $product->id,
            'product_variant_id' => null,
            'quantity' => 50,
        ]);

        BranchStock::create([
            'branch_id' => $branch2->id,
            'product_id' => $product->id,
            'product_variant_id' => null,
            'quantity' => 0,
        ]);

        // 3. Initiate Transfer of 20 items from Main Branch to Branch 2
        $transferRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/stock-transfers', [
                'from_branch_id' => $this->mainBranch->id,
                'to_branch_id' => $branch2->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity_sent' => 20,
                    ]
                ],
                'notes' => 'تحويل بضاعة افتتاحية لفرع مدينة نصر',
            ]);

        $transferRes->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'IN_TRANSIT');

        $transferId = $transferRes->json('data.id');

        // Verify stock is immediately deducted from Main Branch
        $this->assertEquals(30, BranchStock::where('branch_id', $this->mainBranch->id)->where('product_id', $product->id)->value('quantity'));
        // Destination branch still has 0 until received
        $this->assertEquals(0, BranchStock::where('branch_id', $branch2->id)->where('product_id', $product->id)->value('quantity'));

        // 4. Confirm Receipt at Destination Branch
        $receiveRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/stock-transfers/{$transferId}/receive");

        $receiveRes->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.status', 'RECEIVED');

        // Verify stock is now 20 at Destination Branch
        $this->assertEquals(20, BranchStock::where('branch_id', $branch2->id)->where('product_id', $product->id)->value('quantity'));
    }

    public function test_cannot_transfer_more_stock_than_available_at_source(): void
    {
        $branch2 = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'مخزن الهرم',
            'code' => 'BR-03',
            'type' => BranchType::WAREHOUSE,
            'is_main' => false,
            'is_active' => true,
        ]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'بنطلون جينز أزرق',
            'sale_price' => 350,
            'purchase_price' => 200,
            'quantity' => 5,
        ]);

        BranchStock::create([
            'branch_id' => $this->mainBranch->id,
            'product_id' => $product->id,
            'product_variant_id' => null,
            'quantity' => 5,
        ]);

        // Try to transfer 15 items when only 5 are available
        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/stock-transfers', [
                'from_branch_id' => $this->mainBranch->id,
                'to_branch_id' => $branch2->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity_sent' => 15,
                    ]
                ]
            ]);

        $res->assertStatus(422);
        $res->assertJson([
            'success' => false,
            'error_code' => 'INSUFFICIENT_TRANSFER_STOCK',
        ]);
    }

    public function test_can_cancel_transfer_and_reverts_stock_to_source(): void
    {
        $branch2 = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع التجمع',
            'code' => 'BR-04',
            'type' => BranchType::STORE,
            'is_main' => false,
            'is_active' => true,
        ]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'حذاء رياضي جلد',
            'sale_price' => 600,
            'purchase_price' => 400,
            'quantity' => 10,
        ]);

        BranchStock::create([
            'branch_id' => $this->mainBranch->id,
            'product_id' => $product->id,
            'product_variant_id' => null,
            'quantity' => 10,
        ]);

        // Initiate transfer of 4
        $transferRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/stock-transfers', [
                'from_branch_id' => $this->mainBranch->id,
                'to_branch_id' => $branch2->id,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity_sent' => 4,
                    ]
                ]
            ]);

        $transferId = $transferRes->json('data.id');
        $this->assertEquals(6, BranchStock::where('branch_id', $this->mainBranch->id)->where('product_id', $product->id)->value('quantity'));

        // Cancel transfer
        $cancelRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson("/api/stock-transfers/{$transferId}/cancel", [
                'reason' => 'إلغاء بناء على طلب العميل',
            ]);

        $cancelRes->assertOk()
            ->assertJsonPath('data.status', 'CANCELLED');

        // Stock must be restored back to 10 at Main Branch
        $this->assertEquals(10, BranchStock::where('branch_id', $this->mainBranch->id)->where('product_id', $product->id)->value('quantity'));
    }

    public function test_pos_invoice_deducts_stock_from_specified_branch(): void
    {
        $branch2 = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع أكتوبر',
            'code' => 'BR-05',
            'type' => BranchType::STORE,
            'is_main' => false,
            'is_active' => true,
        ]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'تيشيرت بولو صيفي',
            'sale_price' => 180,
            'purchase_price' => 100,
            'quantity' => 30,
        ]);

        BranchStock::create([
            'branch_id' => $this->mainBranch->id,
            'product_id' => $product->id,
            'quantity' => 20,
        ]);

        BranchStock::create([
            'branch_id' => $branch2->id,
            'product_id' => $product->id,
            'quantity' => 10,
        ]);

        // Sell 3 items specifically from Branch 2
        $invoiceRes = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/invoices', [
                'branch_id' => $branch2->id,
                'date' => now()->toDateString(),
                'type' => 'SALE',
                'payment_method' => 'CASH',
                'paid_amount' => 540,
                'items' => [
                    [
                        'product_id' => $product->id,
                        'quantity' => 3,
                        'unit_price' => 180,
                    ]
                ]
            ]);

        $invoiceRes->assertStatus(201);

        // Branch 2 stock should be reduced from 10 to 7
        $this->assertEquals(7, BranchStock::where('branch_id', $branch2->id)->where('product_id', $product->id)->value('quantity'));
        // Main branch stock should remain unchanged at 20
        $this->assertEquals(20, BranchStock::where('branch_id', $this->mainBranch->id)->where('product_id', $product->id)->value('quantity'));
        // Total product quantity is now 27
        $this->assertEquals(27, Product::find($product->id)->quantity);
    }
}
