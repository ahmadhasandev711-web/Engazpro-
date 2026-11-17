<?php

namespace Tests\Feature;

use App\Enums\EcommercePlatform;
use App\Enums\InvoiceType;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\ProductType;
use App\Enums\SubscriptionStatus;
use App\Enums\TreasuryType;
use App\Enums\UserRole;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\OnlineOrder;
use App\Models\OnlineOrderItem;
use App\Models\Party;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TenantIsolationAndSecurityHardeningTest extends TestCase
{
    use RefreshDatabase;

    private function createMerchantWithStore(string $suffix, bool $ecommerce = true): array
    {
        $owner = User::factory()->create([
            'role' => UserRole::OWNER->value,
            'ecommerce_enabled' => $ecommerce,
        ]);
        Subscription::create([
            'user_id' => $owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value,
            'plan' => 'PRO',
        ]);
        $branch = Branch::create([
            'user_id' => $owner->id,
            'name' => "فرع {$suffix}",
            'code' => "BR-{$suffix}",
            'is_main' => true,
            'is_active' => true,
        ]);
        $treasury = Treasury::create([
            'user_id' => $owner->id,
            'branch_id' => $branch->id,
            'name' => "خزينة {$suffix}",
            'type' => TreasuryType::MAIN->value,
            'balance' => 5000,
        ]);

        return [$owner, $branch, $treasury];
    }

    public function test_purchase_report_top_products_is_strictly_isolated_per_tenant(): void
    {
        [$ownerA, $branchA, $treasuryA] = $this->createMerchantWithStore('A');
        [$ownerB, $branchB, $treasuryB] = $this->createMerchantWithStore('B');

        $productA = Product::create([
            'user_id' => $ownerA->id, 'name' => 'صنف متجر أ', 'code' => 'A-1',
            'purchase_price' => 50, 'sale_price' => 100, 'quantity' => 10, 'type' => ProductType::STANDARD->value,
        ]);
        $productB = Product::create([
            'user_id' => $ownerB->id, 'name' => 'صنف سري متجر ب', 'code' => 'B-1',
            'purchase_price' => 200, 'sale_price' => 400, 'quantity' => 5, 'type' => ProductType::STANDARD->value,
        ]);
        $supplierB = Party::create(['user_id' => $ownerB->id, 'name' => 'مورد ب', 'type' => PartyType::SUPPLIER->value]);

        $invA = Invoice::create([
            'user_id' => $ownerA->id, 'branch_id' => $branchA->id, 'treasury_id' => $treasuryA->id,
            'invoice_number' => 'PUR-A-1', 'type' => InvoiceType::PURCHASE->value, 'date' => now()->toDateString(),
            'subtotal' => 500, 'total' => 500, 'paid_amount' => 500, 'payment_method' => PaymentMethod::CASH->value,
        ]);
        InvoiceItem::create([
            'invoice_id' => $invA->id, 'product_id' => $productA->id, 'product_name' => $productA->name,
            'quantity' => 10, 'unit_price' => 50, 'total' => 500,
        ]);

        $invB = Invoice::create([
            'user_id' => $ownerB->id, 'branch_id' => $branchB->id, 'treasury_id' => $treasuryB->id, 'party_id' => $supplierB->id,
            'invoice_number' => 'PUR-B-1', 'type' => InvoiceType::PURCHASE->value, 'date' => now()->toDateString(),
            'subtotal' => 2000, 'total' => 2000, 'paid_amount' => 2000, 'payment_method' => PaymentMethod::CASH->value,
        ]);
        InvoiceItem::create([
            'invoice_id' => $invB->id, 'product_id' => $productB->id, 'product_name' => $productB->name,
            'quantity' => 10, 'unit_price' => 200, 'total' => 2000,
        ]);

        $res = $this->actingAs($ownerA)->getJson('/api/reports/purchases')->assertOk();

        $productIds = collect($res->json('data.top_products'))->pluck('product_id')->all();
        $this->assertSame([$productA->id], $productIds);
        $this->assertNotContains($productB->id, $productIds);
    }

    public function test_cross_tenant_branch_mandob_and_treasury_ids_are_rejected_with_422(): void
    {
        [$ownerA, $branchA] = $this->createMerchantWithStore('A');
        [$ownerB, $branchB, $treasuryB] = $this->createMerchantWithStore('B');

        $productA = Product::create([
            'user_id' => $ownerA->id, 'name' => 'صنف أ', 'code' => 'PA-1',
            'purchase_price' => 10, 'sale_price' => 20, 'quantity' => 10, 'type' => ProductType::STANDARD->value,
        ]);
        BranchStock::create(['branch_id' => $branchA->id, 'product_id' => $productA->id, 'quantity' => 10]);

        $shopifyOrderA = OnlineOrder::create([
            'user_id' => $ownerA->id, 'platform' => EcommercePlatform::SHOPIFY,
            'external_order_id' => '9901', 'external_order_number' => '#9901',
            'status' => WcOrderStatus::PENDING_CONFIRMATION, 'payment_status' => WcPaymentStatus::PENDING_COD,
            'total' => 100, 'subtotal' => 100,
        ]);
        OnlineOrderItem::create([
            'user_id' => $ownerA->id, 'online_order_id' => $shopifyOrderA->id, 'product_id' => $productA->id, 'quantity' => 1,
        ]);

        $wcOrderA = OnlineOrder::create([
            'user_id' => $ownerA->id, 'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '8801', 'external_order_number' => '#8801',
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'payment_status' => WcPaymentStatus::PENDING_COD, 'total' => 100, 'subtotal' => 100,
        ]);

        // Cross-tenant confirm order rejected
        $this->actingAs($ownerA)->postJson("/api/online-orders/{$shopifyOrderA->id}/confirm", ['branch_id' => $branchB->id])
            ->assertStatus(422);
        $this->actingAs($ownerA)->postJson("/api/online-orders/{$wcOrderA->id}/confirm", ['branch_id' => $branchB->id])
            ->assertStatus(422);

        // Cross-tenant mandob rejected
        $this->actingAs($ownerA)->postJson("/api/online-orders/{$shopifyOrderA->id}/dispatch", ['mandob_id' => $ownerB->id])
            ->assertStatus(422);

        // Cross-tenant online_branch_id in WooCommerce settings rejected
        $this->actingAs($ownerA)->postJson('/api/woocommerce/settings', [
            'store_url' => 'https://merchant-a.example.com',
            'online_branch_id' => $branchB->id,
        ])->assertStatus(422);

        // Cross-tenant branch/product in StockTransferRequest rejected
        $this->actingAs($ownerA)->postJson('/api/stock-transfers', [
            'from_branch_id' => $branchA->id,
            'to_branch_id' => $branchB->id,
            'items' => [['product_id' => $productA->id, 'quantity_sent' => 1]],
        ])->assertStatus(422);

        // Cross-tenant treasury in ExpenseRequest rejected
        $this->actingAs($ownerA)->postJson('/api/expenses', [
            'title' => 'مصروف اختبار', 'amount' => 50, 'date' => now()->toDateString(), 'treasury_id' => $treasuryB->id,
        ])->assertStatus(422);
    }

    public function test_stock_operations_and_ecommerce_policies_enforce_role_authorization(): void
    {
        [$owner, $branch] = $this->createMerchantWithStore('P');
        $cashier = User::factory()->create(['owner_id' => $owner->id, 'branch_id' => $branch->id, 'role' => UserRole::CASHIER->value]);
        $mandob = User::factory()->create(['owner_id' => $owner->id, 'branch_id' => $branch->id, 'role' => UserRole::MANDOB->value]);

        $this->actingAs($cashier)->getJson('/api/stock/alerts/summary')->assertStatus(403);
        $this->actingAs($mandob)->getJson('/api/stock/alerts')->assertStatus(403);
        $this->actingAs($cashier)->getJson('/api/stock/movements')->assertStatus(403);
        $this->actingAs($cashier)->getJson('/api/shopify/settings')->assertStatus(403);
        $this->actingAs($mandob)->getJson('/api/woocommerce/settings')->assertStatus(403);
    }
}
