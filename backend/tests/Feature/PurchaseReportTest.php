<?php

namespace Tests\Feature;

use App\Enums\InvoiceType;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\ProductType;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\Party;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use App\Services\InvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseReportTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $cashier;
    protected Branch $branch;

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

        $this->branch = Branch::create(['user_id' => $this->owner->id, 'name' => 'الرئيسي', 'code' => 'BR-1', 'is_main' => true, 'is_active' => true]);
        $this->cashier = User::factory()->create(['owner_id' => $this->owner->id, 'branch_id' => $this->branch->id, 'role' => UserRole::CASHIER->value]);
    }

    public function test_purchase_report_aggregates_purchases_returns_suppliers_and_products(): void
    {
        $supA = Party::create(['user_id' => $this->owner->id, 'type' => PartyType::SUPPLIER->value, 'name' => 'مورد الدلتا']);
        $supB = Party::create(['user_id' => $this->owner->id, 'type' => PartyType::SUPPLIER->value, 'name' => 'مورد المتحدة']);
        $prod = Product::create(['user_id' => $this->owner->id, 'name' => 'شاحن سريع', 'purchase_price' => 100, 'sale_price' => 180, 'quantity' => 0, 'unit' => 'قطعة', 'type' => ProductType::STANDARD->value]);

        $invoiceService = app(InvoiceService::class);
        $invoiceService->createInvoice($this->owner, [
            'type' => InvoiceType::PURCHASE->value, 'party_id' => $supA->id, 'branch_id' => $this->branch->id,
            'payment_method' => PaymentMethod::CASH->value, 'paid_amount' => 1000,
            'items' => [['product_id' => $prod->id, 'quantity' => 10, 'unit_price' => 100]],
        ]);
        $invoiceService->createInvoice($this->owner, [
            'type' => InvoiceType::PURCHASE->value, 'party_id' => $supB->id, 'branch_id' => $this->branch->id,
            'payment_method' => PaymentMethod::CREDIT->value, 'paid_amount' => 0,
            'items' => [['product_id' => $prod->id, 'quantity' => 5, 'unit_price' => 120]],
        ]);
        $invoiceService->createInvoice($this->owner, [
            'type' => InvoiceType::PURCHASE_RETURN->value, 'party_id' => $supA->id, 'branch_id' => $this->branch->id,
            'payment_method' => PaymentMethod::CREDIT->value, 'paid_amount' => 0,
            'items' => [['product_id' => $prod->id, 'quantity' => 2, 'unit_price' => 100]],
        ]);

        // Cashier forbidden
        $this->actingAs($this->cashier)->getJson('/api/reports/purchases')->assertStatus(403);

        $res = $this->actingAs($this->owner)->getJson('/api/reports/purchases');
        $res->assertOk()
            ->assertJsonPath('data.summary.total_purchases', 1600)
            ->assertJsonPath('data.summary.total_purchase_returns', 200)
            ->assertJsonPath('data.summary.net_purchases', 1400)
            ->assertJsonPath('data.summary.cash_purchases', 1000)
            ->assertJsonPath('data.summary.credit_purchases', 600)
            ->assertJsonPath('data.top_suppliers.0.supplier_name', 'مورد الدلتا')
            ->assertJsonPath('data.top_products.0.total_quantity', 15);
    }
}
