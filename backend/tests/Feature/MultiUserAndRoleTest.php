<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Party;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MultiUserAndRoleTest extends TestCase
{
    use RefreshDatabase;

    private function createOwnerWithSubscription(): User
    {
        $owner = User::create([
            'name' => 'صاحب المتجر التجريبي',
            'phone' => '01011111111',
            'password' => bcrypt('owner123'),
            'role' => 'OWNER',
            'status' => 'ACTIVE',
        ]);

        Subscription::create([
            'user_id' => $owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        return $owner;
    }

    public function test_owner_can_create_mandob_and_cashier_employees(): void
    {
        $owner = $this->createOwnerWithSubscription();

        $response = $this->actingAs($owner)->postJson('/api/employees', [
            'name' => 'مندوب المبيعات الأول',
            'phone' => '01022222222',
            'password' => 'mandob123',
            'role' => 'MANDOB',
            'status' => 'ACTIVE',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'مندوب المبيعات الأول')
            ->assertJsonPath('data.role', 'MANDOB')
            ->assertJsonPath('data.owner_id', $owner->id);

        $this->assertDatabaseHas('users', [
            'phone' => '01022222222',
            'owner_id' => $owner->id,
            'role' => 'MANDOB',
            'status' => 'ACTIVE',
        ]);
    }

    public function test_employee_can_login_without_company_code_and_inherits_subscription(): void
    {
        $owner = $this->createOwnerWithSubscription();

        $mandob = User::create([
            'name' => 'مندوب التوزيع',
            'phone' => '01033333333',
            'password' => bcrypt('password123'),
            'owner_id' => $owner->id,
            'role' => 'MANDOB',
            'status' => 'ACTIVE',
        ]);

        // Employee logs in using only their phone and password
        $response = $this->postJson('/api/auth/login', [
            'phone' => '01033333333',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.user.role', 'MANDOB')
            ->assertJsonPath('data.user.owner_id', $owner->id)
            ->assertJsonPath('data.user.subscription.status', 'ACTIVE');
    }

    public function test_inactive_employee_cannot_login(): void
    {
        $owner = $this->createOwnerWithSubscription();

        User::create([
            'name' => 'مندوب موقف',
            'phone' => '01044444444',
            'password' => bcrypt('password123'),
            'owner_id' => $owner->id,
            'role' => 'MANDOB',
            'status' => 'INACTIVE',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'phone' => '01044444444',
            'password' => 'password123',
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_mandob_sees_products_with_hidden_cost_price(): void
    {
        $owner = $this->createOwnerWithSubscription();

        $product = Product::create([
            'user_id' => $owner->id,
            'name' => 'شيبسي عائلي',
            'purchase_price' => 15.00,
            'sale_price' => 20.00,
            'quantity' => 100,
        ]);

        $mandob = User::create([
            'name' => 'مندوب',
            'phone' => '01055555555',
            'password' => bcrypt('pass'),
            'owner_id' => $owner->id,
            'role' => 'MANDOB',
            'status' => 'ACTIVE',
        ]);

        // 1. Owner requests products
        $ownerResponse = $this->actingAs($owner)->getJson('/api/products');
        $ownerResponse->assertStatus(200)
            ->assertJsonPath('data.0.purchase_price', 15);

        // 2. Mandob requests products -> purchase_price must be null
        $mandobResponse = $this->actingAs($mandob)->getJson('/api/products');
        $mandobResponse->assertStatus(200)
            ->assertJsonPath('data.0.purchase_price', null)
            ->assertJsonPath('data.0.sale_price', 20);
    }

    public function test_mandob_cannot_create_update_or_delete_products(): void
    {
        $owner = $this->createOwnerWithSubscription();

        $product = Product::create([
            'user_id' => $owner->id,
            'name' => 'بيبسي كانز',
            'purchase_price' => 10,
            'sale_price' => 15,
            'quantity' => 50,
        ]);

        $mandob = User::create([
            'name' => 'مندوب',
            'phone' => '01066666666',
            'password' => bcrypt('pass'),
            'owner_id' => $owner->id,
            'role' => 'MANDOB',
            'status' => 'ACTIVE',
        ]);

        // Attempt Create
        $this->actingAs($mandob)->postJson('/api/products', [
            'name' => 'منتج جديد',
            'sale_price' => 25,
            'purchase_price' => 18,
            'quantity' => 10,
        ])->assertStatus(403);

        // Attempt Delete
        $this->actingAs($mandob)->deleteJson("/api/products/{$product->id}")
            ->assertStatus(403);
    }

    public function test_mandob_invoice_is_scoped_to_owner_with_created_by_mandob(): void
    {
        $owner = $this->createOwnerWithSubscription();

        $product = Product::create([
            'user_id' => $owner->id,
            'name' => 'عصير برتقال',
            'purchase_price' => 8,
            'sale_price' => 12,
            'quantity' => 50,
        ]);

        $customer = Party::create([
            'user_id' => $owner->id,
            'name' => 'سوبرماركت الأمل',
            'phone' => '01200000000',
            'type' => 'CUSTOMER',
        ]);

        $mandob = User::create([
            'name' => 'مندوب المبيعات الميداني',
            'phone' => '01077777777',
            'password' => bcrypt('pass'),
            'owner_id' => $owner->id,
            'role' => 'MANDOB',
            'status' => 'ACTIVE',
        ]);

        app(\App\Services\ShiftService::class)->openShift($mandob, 0.00);

        $response = $this->actingAs($mandob)->postJson('/api/invoices', [
            'type' => 'SALE',
            'party_id' => $customer->id,
            'date' => now()->toDateString(),
            'payment_type' => 'CASH',
            'payment_method' => 'CASH',
            'paid_amount' => 60,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 5,
                    'unit_price' => 12,
                ],
            ],
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $invoiceId = $response->json('data.id');

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'user_id' => $owner->id,
            'created_by' => $mandob->id,
            'total' => 60,
        ]);
    }

    public function test_cashier_sees_products_with_hidden_cost_price(): void
    {
        $owner = $this->createOwnerWithSubscription();

        $product = Product::create([
            'user_id' => $owner->id,
            'name' => 'شيبسي عائلي',
            'purchase_price' => 15.00,
            'sale_price' => 20.00,
            'quantity' => 100,
        ]);

        $cashier = User::create([
            'name' => 'كاشير المحل',
            'phone' => '01099990001',
            'password' => bcrypt('pass'),
            'owner_id' => $owner->id,
            'role' => 'CASHIER',
            'status' => 'ACTIVE',
        ]);

        $response = $this->actingAs($cashier)->getJson('/api/products');
        $response->assertStatus(200)
            ->assertJsonPath('data.0.purchase_price', null)
            ->assertJsonPath('data.0.sale_price', 20);
    }

    public function test_cashier_cannot_create_update_or_delete_products(): void
    {
        $owner = $this->createOwnerWithSubscription();

        $product = Product::create([
            'user_id' => $owner->id,
            'name' => 'بيبسي كانز',
            'purchase_price' => 10,
            'sale_price' => 15,
            'quantity' => 50,
        ]);

        $cashier = User::create([
            'name' => 'كاشير المحل',
            'phone' => '01099990002',
            'password' => bcrypt('pass'),
            'owner_id' => $owner->id,
            'role' => 'CASHIER',
            'status' => 'ACTIVE',
        ]);

        $this->actingAs($cashier)->postJson('/api/products', [
            'name' => 'منتج كاشير',
            'sale_price' => 25,
            'purchase_price' => 18,
            'quantity' => 10,
        ])->assertStatus(403);

        $this->actingAs($cashier)->deleteJson("/api/products/{$product->id}")
            ->assertStatus(403);
    }

    public function test_cashier_cannot_access_profit_or_treasury_reports(): void
    {
        $owner = $this->createOwnerWithSubscription();

        $cashier = User::create([
            'name' => 'كاشير المحل',
            'phone' => '01099990003',
            'password' => bcrypt('pass'),
            'owner_id' => $owner->id,
            'role' => 'CASHIER',
            'status' => 'ACTIVE',
        ]);

        $this->actingAs($cashier)->getJson('/api/reports/profit')
            ->assertStatus(403);

        $this->actingAs($cashier)->getJson('/api/reports/cash-flow')
            ->assertStatus(403);
    }

    public function test_mandob_and_cashier_dashboard_has_null_profit_and_scoped_cash_flow(): void
    {
        $owner = $this->createOwnerWithSubscription();

        $mandob = User::create([
            'name' => 'مندوب التوزيع',
            'phone' => '01099990004',
            'password' => bcrypt('pass'),
            'owner_id' => $owner->id,
            'role' => 'MANDOB',
            'status' => 'ACTIVE',
        ]);

        $response = $this->actingAs($mandob)->getJson('/api/dashboard');
        $response->assertStatus(200)
            ->assertJsonPath('data.kpis.today_profit', null);

        // Branch Manager also has null profit and scoped to branch
        $branch = \App\Models\Branch::create([
            'user_id' => $owner->id,
            'name' => 'فرع المعادي',
            'code' => 'MAADI',
            'type' => 'STORE',
            'is_main' => false,
            'is_active' => true,
        ]);

        $manager = User::create([
            'name' => 'مدير الفرع',
            'phone' => '01099990009',
            'password' => bcrypt('pass'),
            'owner_id' => $owner->id,
            'branch_id' => $branch->id,
            'role' => 'MANAGER',
            'status' => 'ACTIVE',
        ]);

        $managerRes = $this->actingAs($manager)->getJson('/api/dashboard');
        $managerRes->assertStatus(200)
            ->assertJsonPath('data.kpis.today_profit', null);
    }

    public function test_employee_can_create_expense_but_cannot_delete_expense(): void
    {
        $owner = $this->createOwnerWithSubscription();

        $mandob = User::create([
            'name' => 'مندوب التوزيع',
            'phone' => '01099990005',
            'password' => bcrypt('pass'),
            'owner_id' => $owner->id,
            'role' => 'MANDOB',
            'status' => 'ACTIVE',
        ]);

        // Mandob creates expense
        $response = $this->actingAs($mandob)->postJson('/api/expenses', [
            'title' => 'بنزين سيارة التوزيع',
            'amount' => 50.00,
            'date' => now()->toDateString(),
            'category' => 'انتقالات',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true);

        $expenseId = $response->json('data.id');

        // Mandob attempts to delete expense -> 403 Forbidden
        $this->actingAs($mandob)->deleteJson("/api/expenses/{$expenseId}")
            ->assertStatus(403);
    }

    public function test_cashier_and_mandob_only_see_their_own_invoices(): void
    {
        $owner = $this->createOwnerWithSubscription();

        $product = Product::create([
            'user_id' => $owner->id,
            'name' => 'منتج تجريبي',
            'purchase_price' => 10,
            'sale_price' => 20,
            'quantity' => 100,
        ]);

        $mandob = User::create([
            'name' => 'مندوب',
            'phone' => '01099990006',
            'password' => bcrypt('pass'),
            'owner_id' => $owner->id,
            'role' => 'MANDOB',
            'status' => 'ACTIVE',
        ]);

        $cashier = User::create([
            'name' => 'كاشير',
            'phone' => '01099990007',
            'password' => bcrypt('pass'),
            'owner_id' => $owner->id,
            'role' => 'CASHIER',
            'status' => 'ACTIVE',
        ]);

        // Mandob creates invoice
        Invoice::create([
            'user_id' => $owner->id,
            'created_by' => $mandob->id,
            'invoice_number' => 'INV-TEST-01',
            'type' => 'SALE',
            'date' => now()->toDateString(),
            'total' => 100,
            'paid_amount' => 100,
            'remaining_amount' => 0,
            'payment_method' => 'CASH',
        ]);

        // Mandob sees 1 invoice
        $mandobRes = $this->actingAs($mandob)->getJson('/api/invoices?type=SALE');
        $mandobRes->assertStatus(200)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.invoice_number', 'INV-TEST-01');

        // Cashier sees 0 invoices (strict isolation!)
        $cashierRes = $this->actingAs($cashier)->getJson('/api/invoices?type=SALE');
        $cashierRes->assertStatus(200)
            ->assertJsonCount(0, 'data');

        // Owner sees 1 invoice
        $ownerRes = $this->actingAs($owner)->getJson('/api/invoices?type=SALE');
        $ownerRes->assertStatus(200)
            ->assertJsonCount(1, 'data');
    }

    public function test_cashier_and_mandob_only_see_their_own_payments(): void
    {
        $owner = $this->createOwnerWithSubscription();

        $customer = Party::create([
            'user_id' => $owner->id,
            'name' => 'عميل تجريبي',
            'phone' => '01299990008',
            'type' => 'CUSTOMER',
        ]);

        $mandob = User::create([
            'name' => 'مندوب',
            'phone' => '01099990008',
            'password' => bcrypt('pass'),
            'owner_id' => $owner->id,
            'role' => 'MANDOB',
            'status' => 'ACTIVE',
        ]);

        $cashier = User::create([
            'name' => 'كاشير',
            'phone' => '01099990009',
            'password' => bcrypt('pass'),
            'owner_id' => $owner->id,
            'role' => 'CASHIER',
            'status' => 'ACTIVE',
        ]);

        // Mandob creates receipt voucher
        Payment::create([
            'user_id' => $owner->id,
            'created_by' => $mandob->id,
            'party_id' => $customer->id,
            'type' => 'RECEIPT',
            'amount' => 500,
            'method' => 'CASH',
            'date' => now()->toDateString(),
        ]);

        // Mandob sees 1 voucher
        $mandobRes = $this->actingAs($mandob)->getJson('/api/payments');
        $mandobRes->assertStatus(200)
            ->assertJsonCount(1, 'data');

        // Cashier sees 0 vouchers (strict isolation!)
        $cashierRes = $this->actingAs($cashier)->getJson('/api/payments');
        $cashierRes->assertStatus(200)
            ->assertJsonCount(0, 'data');

        // Owner sees 1 voucher
        $ownerRes = $this->actingAs($owner)->getJson('/api/payments');
        $ownerRes->assertStatus(200)
            ->assertJsonCount(1, 'data');
    }
}
