<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\InvoiceReturnStatus;
use App\Enums\InvoiceType;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\ProductType;
use App\Enums\SubscriptionStatus;
use App\Enums\TreasuryType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Party;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoiceReturnStatusAndBadgesTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private Branch $branch;
    private Product $product;
    private Party $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'role' => UserRole::OWNER->value,
            'phone' => '01099110001',
            'status' => UserStatus::ACTIVE->value,
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value,
            'plan' => 'PRO',
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'MAIN-01',
            'type' => BranchType::STORE->value,
            'is_main' => true,
            'is_active' => true,
        ]);

        Treasury::create([
            'user_id' => $this->owner->id,
            'branch_id' => $this->branch->id,
            'name' => 'خزينة الفرع',
            'type' => TreasuryType::BRANCH_SAFE->value,
            'balance' => 10000,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'جاكيت شتوي',
            'code' => 'JCK-01',
            'type' => ProductType::STANDARD->value,
            'purchase_price' => 400,
            'regular_price' => 800,
            'sale_price' => 800,
            'quantity' => 50,
            'unit' => 'قطعة',
        ]);

        BranchStock::create([
            'branch_id' => $this->branch->id,
            'product_id' => $this->product->id,
            'quantity' => 50,
        ]);

        $this->customer = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'خالد علي',
            'phone' => '01099110002',
            'type' => PartyType::CUSTOMER->value,
            'balance' => 0,
        ]);
    }

    public function test_sale_invoice_transitions_through_none_partial_full_and_reversal_statuses(): void
    {
        Sanctum::actingAs($this->owner);

        // 1. Create parent SALE invoice for 3 units = 2400
        $saleRes = $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE->value,
            'branch_id' => $this->branch->id,
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 2400,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 3,
                    'unit_price' => 800,
                ],
            ],
        ])->assertCreated();

        $parentId = (int) $saleRes->json('data.id');
        $parentNumber = $saleRes->json('data.invoice_number');

        // Verify NONE status in index and show
        $indexBefore = $this->getJson('/api/invoices?type=SALE')->assertOk();
        $this->assertSame(InvoiceReturnStatus::NONE->value, $indexBefore->json('data.0.return_status'));
        $this->assertEquals(0.0, (float) $indexBefore->json('data.0.returned_total'));
        $this->assertSame(0, (int) $indexBefore->json('data.0.returns_count'));

        $showBefore = $this->getJson("/api/invoices/{$parentId}")->assertOk();
        $this->assertSame(InvoiceReturnStatus::NONE->value, $showBefore->json('data.return_status'));

        // 2. Partial SALE_RETURN for 1 unit = 800
        $ret1Res = $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE_RETURN->value,
            'parent_invoice_id' => $parentId,
            'branch_id' => $this->branch->id,
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 800,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                    'unit_price' => 800,
                ],
            ],
        ])->assertCreated();

        $ret1Id = (int) $ret1Res->json('data.id');

        $indexPartial = $this->getJson('/api/invoices?type=SALE')->assertOk();
        $this->assertSame(InvoiceReturnStatus::PARTIAL->value, $indexPartial->json('data.0.return_status'));
        $this->assertEquals(800.0, (float) $indexPartial->json('data.0.returned_total'));
        $this->assertSame(1, (int) $indexPartial->json('data.0.returns_count'));

        $returnsList = $this->getJson('/api/invoices?type=SALE_RETURN')->assertOk();
        $this->assertSame($parentNumber, $returnsList->json('data.0.parent_invoice_number'));

        // 3. Complete remaining 2 units = 1600 -> FULL
        $ret2Res = $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE_RETURN->value,
            'parent_invoice_id' => $parentId,
            'branch_id' => $this->branch->id,
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 1600,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'unit_price' => 800,
                ],
            ],
        ])->assertCreated();

        $ret2Id = (int) $ret2Res->json('data.id');

        $showFull = $this->getJson("/api/invoices/{$parentId}")->assertOk();
        $this->assertSame(InvoiceReturnStatus::FULL->value, $showFull->json('data.return_status'));
        $this->assertEquals(2400.0, (float) $showFull->json('data.returned_total'));
        $this->assertSame(2, (int) $showFull->json('data.returns_count'));

        // 4. Soft-deleting returns reverts parent return_status accurately
        $this->deleteJson("/api/invoices/{$ret2Id}")->assertOk();
        $afterDeleteOne = $this->getJson("/api/invoices/{$parentId}")->assertOk();
        $this->assertSame(InvoiceReturnStatus::PARTIAL->value, $afterDeleteOne->json('data.return_status'));
        $this->assertEquals(800.0, (float) $afterDeleteOne->json('data.returned_total'));

        $this->deleteJson("/api/invoices/{$ret1Id}")->assertOk();
        $afterDeleteAll = $this->getJson("/api/invoices/{$parentId}")->assertOk();
        $this->assertSame(InvoiceReturnStatus::NONE->value, $afterDeleteAll->json('data.return_status'));
        $this->assertEquals(0.0, (float) $afterDeleteAll->json('data.returned_total'));
        $this->assertSame(0, (int) $afterDeleteAll->json('data.returns_count'));
    }
}
