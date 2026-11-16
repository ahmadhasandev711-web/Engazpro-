<?php

namespace Tests\Feature;

use App\Enums\InvoiceType;
use App\Enums\PartyType;
use App\Enums\ProductType;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Party;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\Subscription;
use App\Models\User;
use App\Services\InvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockAlertsAndReorderTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $manager;
    protected Branch $mainBranch;
    protected Branch $secondBranch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => UserRole::OWNER->value]);
        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value,
            'plan' => 'PRO',
        ]);

        $this->mainBranch = Branch::create(['user_id' => $this->owner->id, 'name' => 'الفرع الرئيسي', 'code' => 'BR-1', 'is_main' => true, 'is_active' => true]);
        $this->secondBranch = Branch::create(['user_id' => $this->owner->id, 'name' => 'مخزن أكتوبر', 'code' => 'BR-2', 'is_main' => false, 'is_active' => true]);
        $this->manager = User::factory()->create(['owner_id' => $this->owner->id, 'branch_id' => $this->secondBranch->id, 'role' => UserRole::MANAGER->value]);
    }

    public function test_alerts_return_low_stock_with_last_supplier_and_expiring_batches(): void
    {
        $supplier = Party::create(['user_id' => $this->owner->id, 'type' => PartyType::SUPPLIER->value, 'name' => 'شركة النور للتوريدات']);
        $lowProduct = Product::create([
            'user_id' => $this->owner->id, 'name' => 'بن برازيلي', 'code' => 'COF-1',
            'purchase_price' => 150, 'sale_price' => 240, 'quantity' => 10, 'min_quantity' => 5, 'unit' => 'كجم', 'type' => ProductType::STANDARD->value,
        ]);
        BranchStock::create(['branch_id' => $this->mainBranch->id, 'product_id' => $lowProduct->id, 'quantity' => 2, 'min_quantity' => 5]);
        BranchStock::create(['branch_id' => $this->secondBranch->id, 'product_id' => $lowProduct->id, 'quantity' => 0, 'min_quantity' => 4]);

        app(InvoiceService::class)->createInvoice($this->owner, [
            'type' => InvoiceType::PURCHASE->value,
            'party_id' => $supplier->id,
            'branch_id' => $this->mainBranch->id,
            'items' => [['product_id' => $lowProduct->id, 'quantity' => 2, 'unit_price' => 175]],
            'paid_amount' => 350,
        ]);

        // Set quantity back low on mainBranch after test purchase
        BranchStock::where('branch_id', $this->mainBranch->id)->where('product_id', $lowProduct->id)->update(['quantity' => 3]);

        $expProduct = Product::create([
            'user_id' => $this->owner->id, 'name' => 'لبن طويل الأجل', 'has_expiry' => true,
            'purchase_price' => 30, 'sale_price' => 45, 'quantity' => 10, 'min_quantity' => 2, 'unit' => 'عبوة', 'type' => ProductType::EXPIRY->value,
        ]);
        ProductBatch::create([
            'user_id' => $this->owner->id, 'product_id' => $expProduct->id, 'batch_number' => 'B-2026',
            'expiry_date' => now()->addDays(10)->toDateString(), 'quantity' => 10, 'purchase_price' => 30,
        ]);

        $res = $this->actingAs($this->owner)->getJson('/api/stock/alerts');
        $res->assertOk()
            ->assertJsonPath('data.summary.out_of_stock_count', 1)
            ->assertJsonPath('data.summary.low_stock_count', 1)
            ->assertJsonPath('data.summary.expiring_batches_count', 1);

        $first = collect($res->json('data.low_stock_items'))->firstWhere('branch_id', $this->mainBranch->id);
        $this->assertSame($supplier->id, $first['last_supplier_id']);
        $this->assertSame(175, $first['last_purchase_price']);
        $this->assertSame(7, $first['suggested_reorder_qty']); // min 5 * 2 - 3 = 7

        // Branch Manager is strictly isolated to own branch
        $mgrRes = $this->actingAs($this->manager)->getJson('/api/stock/alerts');
        $mgrRes->assertOk()->assertJsonPath('data.summary.out_of_stock_count', 1)->assertJsonPath('data.summary.low_stock_count', 0);
    }
}
