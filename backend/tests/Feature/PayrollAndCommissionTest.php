<?php

namespace Tests\Feature;

use App\Enums\CommissionType;
use App\Enums\EmployeeAdjustmentType;
use App\Enums\PaymentMethod;
use App\Enums\TreasuryType;
use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\Category;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Treasury;
use App\Models\Unit;
use App\Models\User;
use App\Services\InvoiceService;
use App\Services\TreasuryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PayrollAndCommissionTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $manager;
    protected User $salesperson;
    protected User $cashier;
    protected Branch $branch;
    protected Treasury $branchSafe;
    protected Treasury $bankTreasury;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Owner & Active Subscription
        $this->owner = User::factory()->create([
            'role' => UserRole::OWNER,
            'owner_id' => null,
            'status' => 'ACTIVE',
        ]);
        $this->owner->subscription()->create([
            'plan' => 'BASIC',
            'status' => 'ACTIVE',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
        ]);

        // 2. Branch
        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع الملابس الرئيسي',
            'code' => 'MAIN-APP',
            'type' => 'STORE',
            'is_main' => true,
            'is_active' => true,
        ]);

        // 3. Treasuries (Branch safe funded with 20,000 & Bank with 50,000)
        $treasuryService = app(TreasuryService::class);
        $this->branchSafe = $treasuryService->getBranchTreasury($this->branch->id, $this->owner->id);
        $this->branchSafe->update(['balance' => 20000]);

        $this->bankTreasury = Treasury::create([
            'user_id' => $this->owner->id,
            'name' => 'حساب البنك التجاري',
            'type' => TreasuryType::BANK,
            'balance' => 50000,
            'is_active' => true,
        ]);

        // 4. Manager in branch
        $this->manager = User::factory()->create([
            'owner_id' => $this->owner->id,
            'branch_id' => $this->branch->id,
            'role' => UserRole::MANAGER,
            'base_salary' => 8000,
            'commission_type' => CommissionType::PERCENTAGE_OF_SALES,
            'commission_rate' => 2.0, // 2% from in-store branch sales
            'status' => 'ACTIVE',
        ]);

        // 5. Salesperson in branch
        $this->salesperson = User::factory()->create([
            'owner_id' => $this->owner->id,
            'branch_id' => $this->branch->id,
            'role' => UserRole::SALES,
            'base_salary' => 3000,
            'commission_type' => CommissionType::PERCENTAGE_OF_SALES,
            'commission_rate' => 5.0, // 5% from personal sales
            'status' => 'ACTIVE',
        ]);

        // 6. Cashier
        $this->cashier = User::factory()->create([
            'owner_id' => $this->owner->id,
            'branch_id' => $this->branch->id,
            'role' => UserRole::CASHIER,
            'base_salary' => 4000,
            'commission_type' => CommissionType::NONE,
            'commission_rate' => 0.0,
            'status' => 'ACTIVE',
        ]);

        app(\App\Services\ShiftService::class)->openShift($this->cashier, 0);

        // 7. Category, Unit, and Product
        $category = Category::create(['user_id' => $this->owner->id, 'name' => 'ملابس']);
        $unit = Unit::create(['user_id' => $this->owner->id, 'name' => 'قطعة']);
        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'category_id' => $category->id,
            'unit_id' => $unit->id,
            'name' => 'قميص قطني كاجوال',
            'code' => 'SHIRT-01',
            'sale_price' => 500,
            'purchase_price' => 300,
            'quantity' => 100,
        ]);
    }

    public function test_salesperson_commission_calculation_and_payout(): void
    {
        $invoiceService = app(InvoiceService::class);
        $month = now()->format('Y-m');

        // إنشاء فاتورة بيع منسوبة للسيلز بقيمة 2000 ج.م
        $invoiceService->createInvoice($this->cashier, [
            'type' => 'SALE',
            'salesperson_id' => $this->salesperson->id,
            'payment_method' => 'CASH',
            'paid_amount' => 2000,
            'date' => now()->toDateString(),
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 4,
                    'unit_price' => 500,
                ],
            ],
        ]);

        // إضافة مكافأة 300 وخصم 100 بواسطة المدير
        $this->actingAs($this->manager)
            ->postJson("/api/payroll/{$this->salesperson->id}/adjustments", [
                'type' => EmployeeAdjustmentType::BONUS->value,
                'amount' => 300,
                'date' => now()->toDateString(),
                'reason' => 'مكافأة تميز في المبيعات',
            ])
            ->assertStatus(201);

        $this->actingAs($this->manager)
            ->postJson("/api/payroll/{$this->salesperson->id}/adjustments", [
                'type' => EmployeeAdjustmentType::DEDUCTION->value,
                'amount' => 100,
                'date' => now()->toDateString(),
                'reason' => 'خصم تأخير وردية',
            ])
            ->assertStatus(201);

        // استعراض ملخص المسير:
        // الراتب: 3000
        // المبيعات: 2000 -> العمولة 5%: 100
        // المكافآت: +300
        // الخصومات: -100
        // صافي المستحق: 3000 + 100 + 300 - 100 = 3300
        $res = $this->actingAs($this->manager)
            ->getJson("/api/payroll/{$this->salesperson->id}/summary?month={$month}")
            ->assertStatus(200);

        $data = $res->json('data');
        $this->assertEquals(2000, $data['total_sales']);
        $this->assertEquals(3000, $data['base_salary']);
        $this->assertEquals(100, $data['commission_amount']);
        $this->assertEquals(300, $data['total_bonuses']);
        $this->assertEquals(100, $data['total_deductions']);
        $this->assertEquals(3300, $data['net_payable']);
        $this->assertFalse($data['is_paid']);

        // صرف الراتب من الخزينة النقدية للفرع بواسطة المدير
        $safeInitialBalance = $this->branchSafe->fresh()->balance;
        $this->actingAs($this->manager)
            ->postJson("/api/payroll/{$this->salesperson->id}/disburse", [
                'month' => $month,
                'treasury_id' => $this->branchSafe->id,
                'payment_method' => PaymentMethod::CASH->value,
                'notes' => 'تسليم كاش في الفرع',
            ])
            ->assertStatus(200)
            ->assertJsonPath('data.net_paid', '3300.00');

        // التحقق من خصم المبلغ من الخزينة بدقة ومنع التسريب
        $this->assertEquals($safeInitialBalance - 3300, $this->branchSafe->fresh()->balance);

        // التحقق من منع الصرف المكرر لنفس الشهر
        $this->actingAs($this->manager)
            ->postJson("/api/payroll/{$this->salesperson->id}/disburse", [
                'month' => $month,
                'treasury_id' => $this->branchSafe->id,
                'payment_method' => PaymentMethod::CASH->value,
            ])
            ->assertStatus(422)
            ->assertJsonPath('error_code', 'ALREADY_PAID');
    }

    public function test_manager_commission_calculates_from_branch_sales_excluding_woocommerce(): void
    {
        $invoiceService = app(InvoiceService::class);
        $month = now()->format('Y-m');

        // 1. فاتورة مبيعات فيزيائية في صالة الفرع بقيمة 10,000 ج.م
        $invoiceService->createInvoice($this->cashier, [
            'type' => 'SALE',
            'branch_id' => $this->branch->id,
            'payment_method' => 'CASH',
            'paid_amount' => 10000,
            'date' => now()->toDateString(),
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 20,
                    'unit_price' => 500,
                ],
            ],
        ]);

        // 2. فاتورة متجر إلكتروني ووكومرس لنفس الفرع بقيمة 6,000 ج.م
        $invoiceService->createInvoice($this->owner, [
            'type' => 'SALE',
            'branch_id' => $this->branch->id,
            'wc_order_id' => 12345, // WooCommerce Order
            'payment_method' => 'CARD',
            'paid_amount' => 6000,
            'date' => now()->toDateString(),
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 12,
                    'unit_price' => 500,
                ],
            ],
        ]);

        // استعراض مسير راتب المدير بواسطة المالك:
        // مبيعات الفرع المؤهلة للعمولة يجب أن تكون 10,000 فقط (بدون الـ 6,000 الخاصة بـ WooCommerce!)
        // عمولة المدير: 2% من 10,000 = 200 ج.م
        // الراتب الأساسي: 8000
        // الإجمالي الصافي: 8200
        $res = $this->actingAs($this->owner)
            ->getJson("/api/payroll/{$this->manager->id}/summary?month={$month}")
            ->assertStatus(200);

        $data = $res->json('data');
        $this->assertEquals(10000, $data['total_sales']);
        $this->assertEquals(200, $data['commission_amount']);
        $this->assertEquals(8200, $data['net_payable']);

        // المالك يصرف راتب المدير عبر تحويل بنكي
        $bankInitialBalance = $this->bankTreasury->fresh()->balance;
        $this->actingAs($this->owner)
            ->postJson("/api/payroll/{$this->manager->id}/disburse", [
                'month' => $month,
                'treasury_id' => $this->bankTreasury->id,
                'payment_method' => PaymentMethod::TRANSFER->value,
                'notes' => 'تحويل بنكي IBAN',
            ])
            ->assertStatus(200);

        $this->assertEquals($bankInitialBalance - 8200, $this->bankTreasury->fresh()->balance);
    }

    public function test_manager_cannot_disburse_to_self_or_other_branches(): void
    {
        $month = now()->format('Y-m');

        // 1. المدير يحاول صرف راتب لنفسه -> مرفوض 403
        $this->actingAs($this->manager)
            ->postJson("/api/payroll/{$this->manager->id}/disburse", [
                'month' => $month,
                'treasury_id' => $this->branchSafe->id,
                'payment_method' => PaymentMethod::CASH->value,
            ])
            ->assertStatus(403);

        // 2. إنشاء فرع آخر وموظف في ذلك الفرع
        $otherBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع الإسكندرية',
            'code' => 'ALEX-01',
            'type' => 'STORE',
        ]);
        $otherEmployee = User::factory()->create([
            'owner_id' => $this->owner->id,
            'branch_id' => $otherBranch->id,
            'role' => UserRole::SALES,
            'base_salary' => 3000,
            'status' => 'ACTIVE',
        ]);

        // المدير يحاول إدارة موظف في فرع الإسكندرية -> مرفوض 403
        $this->actingAs($this->manager)
            ->getJson("/api/payroll/{$otherEmployee->id}/summary?month={$month}")
            ->assertStatus(403);
    }

    public function test_owner_and_admin_are_excluded_from_payroll(): void
    {
        $month = now()->format('Y-m');

        $this->actingAs($this->owner)
            ->getJson("/api/payroll/{$this->owner->id}/summary?month={$month}")
            ->assertStatus(403);
    }

    public function test_cashier_and_sales_forbidden_from_managing_payroll(): void
    {
        $month = now()->format('Y-m');

        $this->actingAs($this->cashier)
            ->getJson("/api/payroll/{$this->salesperson->id}/summary?month={$month}")
            ->assertStatus(403);

        $this->actingAs($this->salesperson)
            ->postJson("/api/payroll/{$this->cashier->id}/adjustments", [
                'type' => EmployeeAdjustmentType::BONUS->value,
                'amount' => 500,
                'date' => now()->toDateString(),
            ])
            ->assertStatus(403);
    }

    public function test_employee_creation_and_update_with_salary_and_commission(): void
    {
        // 1. المدير ينشئ كاشير براتب أساسي وعمولة
        $response = $this->actingAs($this->manager)->postJson('/api/employees', [
            'name' => 'كاشير الفرع الجديد',
            'phone' => '01099988877',
            'password' => 'secret123',
            'role' => 'CASHIER',
            'base_salary' => 4500.00,
            'commission_type' => 'PERCENTAGE_OF_SALES',
            'commission_rate' => 1.5,
        ]);

        $response->assertStatus(201);
        $newCashierId = $response->json('data.id');

        $this->assertDatabaseHas('users', [
            'id' => $newCashierId,
            'role' => 'CASHIER',
            'base_salary' => 4500.00,
            'commission_type' => 'PERCENTAGE_OF_SALES',
            'commission_rate' => 1.5,
        ]);

        // 2. التحقق من ظهور الراتب في ملخص المسير
        $month = now()->format('Y-m');
        $summaryRes = $this->actingAs($this->manager)
            ->getJson("/api/payroll/{$newCashierId}/summary?month={$month}");

        $summaryRes->assertStatus(200);
        $this->assertEquals(4500.00, $summaryRes->json('data.employee.base_salary'));
        $this->assertEquals(4500.00, $summaryRes->json('data.net_payable'));

        // 3. تعديل الراتب عبر PUT /api/employees/{id}
        $updateRes = $this->actingAs($this->manager)->putJson("/api/employees/{$newCashierId}", [
            'name' => 'كاشير معدل',
            'phone' => '01099988877',
            'role' => 'CASHIER',
            'base_salary' => 5200.00,
            'commission_type' => 'FIXED_PER_INVOICE',
            'commission_rate' => 10.00,
        ]);

        $updateRes->assertStatus(200);

        $this->assertDatabaseHas('users', [
            'id' => $newCashierId,
            'base_salary' => 5200.00,
            'commission_type' => 'FIXED_PER_INVOICE',
            'commission_rate' => 10.00,
        ]);

        // 4. المدير ينشئ بائع صالة (SALES)
        $salesRes = $this->actingAs($this->manager)->postJson('/api/employees', [
            'name' => 'بائع صالة متميز',
            'phone' => '01055544433',
            'password' => 'secret123',
            'role' => 'SALES',
            'base_salary' => 3500.00,
            'commission_type' => 'PERCENTAGE_OF_SALES',
            'commission_rate' => 3.0,
        ]);

        $salesRes->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'phone' => '01055544433',
            'role' => 'SALES',
            'base_salary' => 3500.00,
        ]);
    }

    /**
     * اختبار أمان تعديل مسؤول المبيعات (Salesperson Reassignment RBAC & Dynamic Commission Reattribution)
     */
    public function test_salesperson_reassignment_and_rbac(): void
    {
        // 1. كاشير يقوم بإنشاء فاتورة بيع نقدية بقيمة 500 جنيه (لديه وردية مفتوحة من setUp)
        $invoiceRes = $this->actingAs($this->cashier)->postJson('/api/invoices', [
            'type' => 'SALE',
            'payment_method' => 'CASH',
            'date' => now()->toDateString(),
            'paid_amount' => 500.00,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 5,
                    'unit_price' => 100.00,
                ],
            ],
        ]);
        $invoiceRes->assertStatus(201);
        $invoiceId = $invoiceRes->json('data.id');

        // عمولة الكاشير الافتراضية محسوبة له (لأنه منشئ الفاتورة)
        $payrollCashierBefore = $this->actingAs($this->manager)->getJson("/api/payroll/{$this->cashier->id}/summary");
        $this->assertEquals(500.00, $payrollCashierBefore->json('data.total_sales'));

        // 2. الكاشير يحاول تعديل مسؤول المبيعات بنفسه -> مرفوض 403 Forbidden
        $cashierForbiddenRes = $this->actingAs($this->cashier)->patchJson("/api/invoices/{$invoiceId}/salesperson", [
            'salesperson_id' => $this->salesperson->id,
        ]);
        $cashierForbiddenRes->assertStatus(403);

        // 3. مدير الفرع يعدل مسؤول المبيعات ليكون البائع (SALES)
        $managerUpdateRes = $this->actingAs($this->manager)->patchJson("/api/invoices/{$invoiceId}/salesperson", [
            'salesperson_id' => $this->salesperson->id,
        ]);
        $managerUpdateRes->assertStatus(200)
            ->assertJsonPath('data.salesperson_id', $this->salesperson->id)
            ->assertJsonPath('data.salesperson_name', $this->salesperson->name);

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'salesperson_id' => $this->salesperson->id,
        ]);

        // 4. التحقق من إعادة توجيه المبيعات والعمولة ديناميكياً إلى البائع وإسقاطها من الكاشير
        $payrollCashierAfter = $this->actingAs($this->manager)->getJson("/api/payroll/{$this->cashier->id}/summary");
        $this->assertEquals(0.00, $payrollCashierAfter->json('data.total_sales'));

        $payrollSalespersonAfter = $this->actingAs($this->manager)->getJson("/api/payroll/{$this->salesperson->id}/summary");
        $this->assertEquals(500.00, $payrollSalespersonAfter->json('data.total_sales'));
        // عمولة البائع 5% من 500 = 25
        $this->assertEquals(25.00, $payrollSalespersonAfter->json('data.commission_amount'));
    }

    /**
     * اختبار تأمين المرتجعات ومنع الكاشير من عمل مرتجع مبيعات دون وردية مفتوحة
     */
    public function test_cashier_cannot_create_sale_return_without_active_shift(): void
    {
        // 1. كاشير جديد ليس لديه وردية مفتوحة
        $cashierWithoutShift = User::factory()->create([
            'owner_id' => $this->owner->id,
            'branch_id' => $this->branch->id,
            'role' => UserRole::CASHIER,
            'status' => 'ACTIVE',
        ]);

        // محاولة عمل مرتجع بيع بدون فتح وردية للكاشير -> يجب أن يُرفض بـ 422
        $returnRes = $this->actingAs($cashierWithoutShift)->postJson('/api/invoices', [
            'type' => 'SALE_RETURN',
            'payment_method' => 'CASH',
            'date' => now()->toDateString(),
            'paid_amount' => 100.00,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                    'unit_price' => 100.00,
                ],
            ],
        ]);

        $returnRes->assertStatus(422)
            ->assertJsonPath('error_code', 'ACTIVE_SHIFT_REQUIRED');

        // 2. بعد فتح الوردية -> ينجح المرتجع ويرتبط بالوردية
        $shiftRes = $this->actingAs($cashierWithoutShift)->postJson('/api/shifts/open', [
            'opening_balance' => 500.00,
        ]);
        $shiftRes->assertStatus(201);
        $shiftId = $shiftRes->json('data.id');

        $returnSuccessRes = $this->actingAs($cashierWithoutShift)->postJson('/api/invoices', [
            'type' => 'SALE_RETURN',
            'payment_method' => 'CASH',
            'date' => now()->toDateString(),
            'paid_amount' => 100.00,
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 1,
                    'unit_price' => 100.00,
                ],
            ],
        ]);

        $returnSuccessRes->assertStatus(201);
        $this->assertDatabaseHas('invoices', [
            'id' => $returnSuccessRes->json('data.id'),
            'type' => 'SALE_RETURN',
            'shift_id' => $shiftId,
        ]);
    }
}
