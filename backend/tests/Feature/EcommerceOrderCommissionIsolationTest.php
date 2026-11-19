<?php

namespace Tests\Feature;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\BranchType;
use App\Enums\CommissionType;
use App\Enums\EcommercePlatform;
use App\Enums\PaymentMethod;
use App\Enums\UserRole;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\OnlineOrder;
use App\Models\Party;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\InvoiceService;
use App\Services\PayrollService;
use App\Services\ShiftService;
use App\Services\TreasuryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class EcommerceOrderCommissionIsolationTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $manager;
    private User $cashier;
    private Branch $branch;
    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create([
            'role' => UserRole::OWNER,
            'ecommerce_enabled' => true,
            'status' => 'ACTIVE',
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'MAIN-COMM',
            'type' => BranchType::STORE,
            'is_main' => true,
            'is_active' => true,
        ]);

        app(TreasuryService::class)->getBranchTreasury($this->branch->id, $this->owner->id);

        WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://mystore.test',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'webhook_secret' => 'sec_test',
            'online_branch_id' => $this->branch->id,
            'is_active' => true,
        ]);

        $mockClient = Mockery::mock(WooCommerceApiClientInterface::class);
        $mockClient->shouldReceive('updateProductStock')->andReturn(true)->byDefault();
        $mockClient->shouldReceive('updateOrderStatus')->andReturn(true)->byDefault();
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);

        $this->manager = User::factory()->create([
            'owner_id' => $this->owner->id,
            'role' => UserRole::MANAGER,
            'branch_id' => $this->branch->id,
            'base_salary' => 5000,
            'commission_type' => CommissionType::PERCENTAGE_OF_SALES,
            'commission_rate' => 5,
            'status' => 'ACTIVE',
        ]);

        $this->cashier = User::factory()->create([
            'owner_id' => $this->owner->id,
            'role' => UserRole::CASHIER,
            'branch_id' => $this->branch->id,
            'base_salary' => 3000,
            'commission_type' => CommissionType::PERCENTAGE_OF_SALES,
            'commission_rate' => 10,
            'status' => 'ACTIVE',
        ]);

        app(ShiftService::class)->openShift($this->cashier, 0);

        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'تيشيرت قطن',
            'wc_product_id' => 999,
            'cost_price' => 100,
            'price' => 250,
            'quantity' => 50,
            'is_active' => true,
        ]);

        BranchStock::create([
            'branch_id' => $this->branch->id,
            'product_id' => $this->product->id,
            'quantity' => 50,
        ]);
    }

    public function test_delivering_online_order_records_creator_but_null_salesperson_and_grants_zero_commission(): void
    {
        $courier = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'شركة شحن سريعة',
            'type' => 'COURIER',
            'balance' => 0,
        ]);

        $order = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '9001',
            'external_order_number' => '#9001',
            'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'payment_method_label' => 'cod',
            'customer_name' => 'عميل أونلاين',
            'customer_phone' => '01000000001',
            'branch_id' => $this->branch->id,
            'courier_party_id' => $courier->id,
            'courier_name' => $courier->name,
            'subtotal' => 250,
            'shipping_cost' => 0,
            'discount_total' => 0,
            'tax_total' => 0,
            'total' => 250,
            'order_date' => now(),
            'items_snapshot' => [
                [
                    'product_id' => 999,
                    'name' => 'تيشيرت قطن',
                    'quantity' => 1,
                    'price' => 250,
                    'total' => 250,
                ],
            ],
        ]);

        $deliverRes = $this->actingAs($this->cashier)->postJson("/api/online-orders/{$order->id}/deliver", [
            'collected_amount' => 250,
        ]);
        $deliverRes->assertOk();

        $invoiceId = $deliverRes->json('data.invoice.id');
        $this->assertNotNull($invoiceId);

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'online_order_id' => $order->id,
            'wc_order_id' => 9001,
            'created_by' => $this->cashier->id,
            'salesperson_id' => null,
        ]);

        // Shopify-linked invoice created via internal order sync service also sets salesperson_id = null
        $shopifyInvoice = app(InvoiceService::class)->createInvoice($this->cashier, [
            'type' => 'SALE',
            'payment_method' => PaymentMethod::TRANSFER->value,
            'date' => now()->toDateString(),
            'paid_amount' => 500,
            'shopify_order_id' => 7788990011,
            'branch_id' => $this->branch->id,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 2, 'unit_price' => 250],
            ],
        ]);

        $this->actingAs($this->cashier)->getJson("/api/invoices/{$shopifyInvoice->id}")
            ->assertOk()
            ->assertJsonPath('data.salesperson_id', null)
            ->assertJsonPath('data.is_ecommerce_order', true)
            ->assertJsonPath('data.created_by', $this->cashier->id);

        // Return of ecommerce invoice keeps salesperson_id null & is_ecommerce_order true
        $this->actingAs($this->cashier)->postJson('/api/invoices', [
            'type' => 'SALE_RETURN',
            'parent_invoice_id' => $invoiceId,
            'payment_method' => PaymentMethod::CASH->value,
            'date' => now()->toDateString(),
            'paid_amount' => 250,
            'branch_id' => $this->branch->id,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 1, 'unit_price' => 250],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.salesperson_id', null)
            ->assertJsonPath('data.is_ecommerce_order', true);

        // Regular local POS sale by the same cashier SHOULD earn commission (10% of 250 = 25)
        $this->actingAs($this->cashier)->postJson('/api/invoices', [
            'type' => 'SALE',
            'payment_method' => PaymentMethod::CASH->value,
            'date' => now()->toDateString(),
            'paid_amount' => 250,
            'branch_id' => $this->branch->id,
            'items' => [
                ['product_id' => $this->product->id, 'quantity' => 1, 'unit_price' => 250],
            ],
        ])->assertCreated()
            ->assertJsonPath('data.salesperson_id', $this->cashier->id)
            ->assertJsonPath('data.is_ecommerce_order', false);

        $payrollService = app(PayrollService::class);
        $month = now()->format('Y-m');

        $cashierPayroll = $payrollService->calculateMonthlyPayroll($this->cashier, $month);
        $this->assertEquals(250.0, $cashierPayroll['total_sales']);
        $this->assertEquals(25.0, $cashierPayroll['commission_amount']);

        $managerPayroll = $payrollService->calculateMonthlyPayroll($this->manager, $month);
        $this->assertEquals(250.0, $managerPayroll['total_sales']);
        $this->assertEquals(12.5, $managerPayroll['commission_amount']);
    }
}
