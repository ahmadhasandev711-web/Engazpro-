<?php

namespace Tests\Feature;

use App\Enums\InvoiceType;
use App\Enums\PaymentMethod;
use App\Enums\UserRole;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Party;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\Subscription;
use App\Models\Unit;
use App\Models\User;
use App\Models\WcOrder;
use App\Models\WooCommerceIntegration;
use App\Services\InvoiceService;
use App\Services\WooCommerce\WooCommerceApiClientInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class CriticalSecurityAndInvariantsPhase2Test extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $manager;
    protected User $cashier;
    protected User $mandob;
    protected Branch $branch;
    protected Product $product;
    protected Party $supplier;
    protected Party $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'role' => UserRole::OWNER,
            'owner_id' => null,
            'status' => 'ACTIVE',
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->subDay(),
            'end_date' => now()->addYear(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع النزهة',
            'code' => 'NZH-01',
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->manager = User::factory()->create([
            'owner_id' => $this->owner->id,
            'branch_id' => $this->branch->id,
            'role' => UserRole::MANAGER,
            'status' => 'ACTIVE',
        ]);

        $this->cashier = User::factory()->create([
            'owner_id' => $this->owner->id,
            'branch_id' => $this->branch->id,
            'role' => UserRole::CASHIER,
            'status' => 'ACTIVE',
        ]);

        $this->mandob = User::factory()->create([
            'owner_id' => $this->owner->id,
            'branch_id' => $this->branch->id,
            'role' => UserRole::MANDOB,
            'status' => 'ACTIVE',
        ]);

        $cat = Category::create(['user_id' => $this->owner->id, 'name' => 'أغذية']);
        $unit = Unit::create(['user_id' => $this->owner->id, 'name' => 'علبة']);

        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'category_id' => $cat->id,
            'unit_id' => $unit->id,
            'name' => 'تونة صن شاين',
            'code' => 'TUNA-01',
            'purchase_price' => 30.00,
            'sale_price' => 50.00,
            'quantity' => 100,
        ]);

        $this->supplier = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'شركة الأغذية المتحدة',
            'type' => 'SUPPLIER',
        ]);

        $this->customer = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'عميل تجريبي',
            'type' => 'CUSTOMER',
        ]);

        app(\App\Services\ShiftService::class)->openShift($this->cashier, 100);
    }

    /**
     * [H1] حظر الكاشير والمندوب من إنشاء فواتير المشتريات
     */
    public function test_cashier_and_mandob_cannot_create_purchase_invoices(): void
    {
        $payload = [
            'type' => 'PURCHASE',
            'party_id' => $this->supplier->id,
            'date' => now()->toDateString(),
            'payment_method' => 'CASH',
            'paid_amount' => 300.00,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 10, 'unit_price' => 30.00],
            ],
        ];

        // Cashier attempt
        $resCashier = $this->actingAs($this->cashier)->postJson('/api/invoices', $payload);
        $resCashier->assertStatus(403);

        // Mandob attempt
        $resMandob = $this->actingAs($this->mandob)->postJson('/api/invoices', $payload);
        $resMandob->assertStatus(403);

        // Manager attempt (allowed)
        $resManager = $this->actingAs($this->manager)->postJson('/api/invoices', $payload);
        $resManager->assertStatus(201);
    }

    /**
     * [H1] حظر الكاشير من إنشاء أوامر تحويل المخزون بين الفروع
     */
    public function test_cashier_cannot_create_stock_transfers(): void
    {
        $branch2 = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع المعادي',
            'code' => 'MAD-01',
            'is_main' => false,
            'is_active' => true,
        ]);

        \App\Models\BranchStock::create([
            'branch_id' => $this->branch->id,
            'product_id' => $this->product->id,
            'quantity' => 20,
        ]);

        $payload = [
            'from_branch_id' => $this->branch->id,
            'to_branch_id' => $branch2->id,
            'items' => [
                ['product_id' => $this->product->id, 'quantity_sent' => 5],
            ],
        ];

        // Cashier attempt
        $resCashier = $this->actingAs($this->cashier)->postJson('/api/stock-transfers', $payload);
        $resCashier->assertStatus(403);

        // Manager attempt (allowed for own branch)
        $resManager = $this->actingAs($this->manager)->postJson('/api/stock-transfers', $payload);
        $resManager->assertStatus(201);
    }

    /**
     * [H2] منع سداد مبالغ أكبر من إجمالي الفاتورة
     */
    public function test_overpayment_beyond_invoice_total_is_strictly_rejected(): void
    {
        // الفاتورة إجماليها 500 جنيه، ومحاولة دفع 600 جنيه
        $response = $this->actingAs($this->cashier)->postJson('/api/invoices', [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'payment_method' => 'CASH',
            'paid_amount' => 600.00,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 10, 'unit_price' => 50.00],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'OVERPAYMENT_NOT_ALLOWED');
    }

    /**
     * [H2] منع سداد مجزأ أكبر من إجمالي الفاتورة
     */
    public function test_split_payments_exceeding_invoice_total_is_strictly_rejected(): void
    {
        // إجمالي 500 جنيه، المجزأ: 300 كاش + 300 إنستاباي = 600 جنيه
        $response = $this->actingAs($this->cashier)->postJson('/api/invoices', [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'payment_method' => 'SPLIT',
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 10, 'unit_price' => 50.00],
            ],
            'split_payments' => [
                ['method' => 'CASH', 'amount' => 300.00],
                ['method' => 'INSTAPAY', 'amount' => 300.00],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error_code', 'OVERPAYMENT_NOT_ALLOWED');
    }

    /**
     * [H3] حظر الكاشير والمندوب من تقارير المبيعات والمخزون
     */
    public function test_cashier_and_mandob_are_forbidden_from_sales_and_stock_reports(): void
    {
        // Sales report
        $this->actingAs($this->cashier)->getJson('/api/reports/sales')->assertStatus(403);
        $this->actingAs($this->mandob)->getJson('/api/reports/sales')->assertStatus(403);
        $this->actingAs($this->owner)->getJson('/api/reports/sales')->assertStatus(200);

        // Stock report
        $this->actingAs($this->cashier)->getJson('/api/reports/stock')->assertStatus(403);
        $this->actingAs($this->mandob)->getJson('/api/reports/stock')->assertStatus(403);
        $this->actingAs($this->owner)->getJson('/api/reports/stock')->assertStatus(200);
    }

    /**
     * [H4] حظر الكاشير من استيراد المنتجات وتأكيد عزل المستأجر عند الاستيراد بواسطة المدير
     */
    public function test_import_products_rbac_and_tenant_account_scoping(): void
    {
        $rows = [
            [
                'name' => 'جبنة بيضاء فيتا',
                'category' => 'ألبان',
                'purchase_price' => 20.00,
                'sale_price' => 28.00,
                'quantity' => 15.00,
            ],
        ];

        // 1. الكاشير ممنوع من المعاينة والاعتماد
        $this->actingAs($this->cashier)->postJson('/api/import/products/preview', ['rows' => $rows])
            ->assertStatus(403);
        $this->actingAs($this->cashier)->postJson('/api/import/products/commit', ['rows' => $rows])
            ->assertStatus(403);

        // 2. المدير يقوم بالاستيراد (مسموح له)
        $res = $this->actingAs($this->manager)->postJson('/api/import/products/commit', [
            'rows' => $rows,
            'duplicate_action' => 'skip',
        ]);
        $res->assertStatus(200);

        // 3. التحقق من أن المنتج والتصنيف تم إنشاؤهما بـ user_id = owner->id وليس manager->id
        $importedProduct = Product::where('name', 'جبنة بيضاء فيتا')->first();
        $this->assertNotNull($importedProduct);
        $this->assertEquals($this->owner->id, $importedProduct->user_id);

        $importedCategory = Category::where('name', 'ألبان')->first();
        $this->assertNotNull($importedCategory);
        $this->assertEquals($this->owner->id, $importedCategory->user_id);
    }
}
