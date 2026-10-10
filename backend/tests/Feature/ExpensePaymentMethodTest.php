<?php

namespace Tests\Feature;

use App\Enums\PaymentMethod;
use App\Enums\TreasuryType;
use App\Models\Branch;
use App\Models\Shift;
use App\Models\Treasury;
use App\Models\User;
use App\Services\ShiftService;
use App\Services\TreasuryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ExpensePaymentMethodTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $cashier;
    protected Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'role' => 'OWNER',
            'owner_id' => null,
            'status' => 'ACTIVE',
        ]);
        $this->owner->subscription()->create([
            'plan' => 'BASIC',
            'status' => 'ACTIVE',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع التجريبي',
            'code' => 'BR-01',
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->cashier = User::factory()->create([
            'role' => 'CASHIER',
            'owner_id' => $this->owner->id,
            'branch_id' => $this->branch->id,
            'status' => 'ACTIVE',
        ]);
    }

    public function test_owner_can_record_expense_with_transfer_method(): void
    {
        Sanctum::actingAs($this->owner);

        $response = $this->postJson('/api/expenses', [
            'title' => 'إيجار المقر الرئيسي',
            'amount' => 500.00,
            'payment_method' => 'TRANSFER',
            'date' => now()->toDateString(),
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('expenses', [
            'user_id' => $this->owner->id,
            'title' => 'إيجار المقر الرئيسي',
            'amount' => '500.00',
            'payment_method' => 'TRANSFER',
        ]);
    }

    public function test_cashier_is_forbidden_from_using_transfer_or_bank_channel(): void
    {
        Sanctum::actingAs($this->cashier);

        $response = $this->postJson('/api/expenses', [
            'title' => 'فاتورة محظورة',
            'amount' => 100.00,
            'payment_method' => 'TRANSFER',
            'date' => now()->toDateString(),
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['payment_method']);
    }

    public function test_cashier_can_record_cash_expense_from_active_shift(): void
    {
        Sanctum::actingAs($this->cashier);

        // فتح وردية نشطة للكاشير
        $shiftService = app(ShiftService::class);
        $shift = $shiftService->openShift($this->cashier, 200.00);

        $response = $this->postJson('/api/expenses', [
            'title' => 'أدوات نظافة للمحل',
            'amount' => 50.00,
            'payment_method' => 'CASH',
            'date' => now()->toDateString(),
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('expenses', [
            'created_by' => $this->cashier->id,
            'title' => 'أدوات نظافة للمحل',
            'amount' => '50.00',
            'payment_method' => 'CASH',
            'shift_id' => $shift->id,
        ]);

        // التحقق من تحديث مصاريف الوردية
        $shift->refresh();
        $this->assertEquals(50.00, (float) $shift->expenses);
    }

    public function test_cashier_can_record_expense_via_vodafone_cash_without_affecting_cash_drawer(): void
    {
        Sanctum::actingAs($this->cashier);

        // فتح وردية للكاشير
        $shiftService = app(ShiftService::class);
        $shift = $shiftService->openShift($this->cashier, 300.00);

        $response = $this->postJson('/api/expenses', [
            'title' => 'نثريات شحن فودافون',
            'amount' => 75.00,
            'payment_method' => 'VODAFONE_CASH',
            'date' => now()->toDateString(),
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('expenses', [
            'created_by' => $this->cashier->id,
            'title' => 'نثريات شحن فودافون',
            'amount' => '75.00',
            'payment_method' => 'VODAFONE_CASH',
            'shift_id' => null, // لم تسجل على درج الوردية
        ]);

        // التحقق من أن مصاريف نقدية الدرج لم تتأثر
        $shift->refresh();
        $this->assertEquals(0.00, (float) $shift->expenses);

        // التحقق من خصم المبلغ من محفظة فودافون كاش
        $wallet = Treasury::where('user_id', $this->owner->id)
            ->where('type', TreasuryType::WALLET)
            ->where('name', 'محفظة فودافون كاش')
            ->first();

        $this->assertNotNull($wallet);
        $this->assertEquals(-75.00, (float) $wallet->balance);
    }

    public function test_cashier_can_record_expense_via_instapay(): void
    {
        Sanctum::actingAs($this->cashier);

        $response = $this->postJson('/api/expenses', [
            'title' => 'سداد مشتريات نثريات إنستاباي',
            'amount' => 120.00,
            'payment_method' => 'INSTAPAY',
            'date' => now()->toDateString(),
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('expenses', [
            'created_by' => $this->cashier->id,
            'payment_method' => 'INSTAPAY',
            'amount' => '120.00',
        ]);

        $instapayWallet = Treasury::where('user_id', $this->owner->id)
            ->where('type', TreasuryType::WALLET)
            ->where('name', 'حساب إنستاباي (InstaPay)')
            ->first();

        $this->assertNotNull($instapayWallet);
        $this->assertEquals(-120.00, (float) $instapayWallet->balance);
    }
}
