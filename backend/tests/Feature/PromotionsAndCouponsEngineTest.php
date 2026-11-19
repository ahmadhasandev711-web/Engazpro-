<?php

namespace Tests\Feature;

use App\Contracts\WooCommerceApiClientInterface;
use App\Enums\BranchType;
use App\Enums\EcommercePlatform;
use App\Enums\InvoiceType;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\ProductType;
use App\Enums\PromotionDiscountType;
use App\Enums\PromotionType;
use App\Enums\ShiftStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\TreasuryType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Category;
use App\Models\OnlineOrder;
use App\Models\Party;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\Setting;
use App\Models\Shift;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\User;
use App\Services\OnlineOrders\OnlineOrderSyncService;
use App\Services\SettingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

class PromotionsAndCouponsEngineTest extends TestCase
{
    use RefreshDatabase;

    private User $ownerA;
    private User $ownerB;
    private Branch $branchA1;
    private Branch $branchA2;
    private Branch $branchB1;
    private Category $catApparel;
    private Product $shirt;
    private Product $socks;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ownerA = $this->createOwner('01099000001');
        $this->ownerB = $this->createOwner('01099000002');

        $this->branchA1 = $this->createBranch($this->ownerA, 'فرع A1', 'A1', true);
        $this->branchA2 = $this->createBranch($this->ownerA, 'فرع A2', 'A2', false);
        $this->branchB1 = $this->createBranch($this->ownerB, 'فرع B1', 'B1', true);

        Treasury::create(['user_id' => $this->ownerA->id, 'branch_id' => $this->branchA1->id, 'name' => 'خزينة A1', 'type' => TreasuryType::BRANCH_SAFE->value, 'balance' => 10000, 'is_active' => true]);
        Treasury::create(['user_id' => $this->ownerA->id, 'branch_id' => $this->branchA2->id, 'name' => 'خزينة A2', 'type' => TreasuryType::BRANCH_SAFE->value, 'balance' => 10000, 'is_active' => true]);
        Treasury::create(['user_id' => $this->ownerB->id, 'branch_id' => $this->branchB1->id, 'name' => 'خزينة B1', 'type' => TreasuryType::BRANCH_SAFE->value, 'balance' => 10000, 'is_active' => true]);

        $this->catApparel = Category::create(['user_id' => $this->ownerA->id, 'name' => 'ملابس']);

        $this->shirt = Product::create([
            'user_id' => $this->ownerA->id,
            'category_id' => $this->catApparel->id,
            'name' => 'قميص قطن',
            'code' => 'SHIRT-1',
            'type' => ProductType::STANDARD->value,
            'purchase_price' => 250,
            'regular_price' => 500,
            'sale_price' => 500,
            'quantity' => 100,
            'unit' => 'قطعة',
        ]);

        $this->socks = Product::create([
            'user_id' => $this->ownerA->id,
            'category_id' => $this->catApparel->id,
            'name' => 'شراب قطن',
            'code' => 'SOCKS-1',
            'type' => ProductType::STANDARD->value,
            'purchase_price' => 100,
            'regular_price' => 200,
            'sale_price' => 200,
            'quantity' => 100,
            'unit' => 'قطعة',
        ]);

        BranchStock::create(['branch_id' => $this->branchA1->id, 'product_id' => $this->shirt->id, 'quantity' => 50]);
        BranchStock::create(['branch_id' => $this->branchA1->id, 'product_id' => $this->socks->id, 'quantity' => 50]);
        BranchStock::create(['branch_id' => $this->branchA2->id, 'product_id' => $this->shirt->id, 'quantity' => 50]);
    }

    private function createOwner(string $phone): User
    {
        $owner = User::factory()->create([
            'role' => UserRole::OWNER->value,
            'phone' => $phone,
            'status' => UserStatus::ACTIVE->value,
        ]);

        Subscription::create([
            'user_id' => $owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value,
            'plan' => 'PRO',
        ]);

        return $owner;
    }

    private function createBranch(User $owner, string $name, string $code, bool $isMain): Branch
    {
        return Branch::create([
            'user_id' => $owner->id,
            'name' => $name,
            'code' => $code,
            'type' => BranchType::STORE->value,
            'is_main' => $isMain,
            'is_active' => true,
        ]);
    }

    public function test_coupon_enforces_cap_min_order_max_uses_branch_and_tenant_isolation(): void
    {
        Sanctum::actingAs($this->ownerA);

        // Create Coupon: SUMMER20 (20%, max discount 150, min order 600, max 1 use, branch A1 only)
        $this->postJson('/api/promotions', [
            'name' => 'كود الصيف',
            'code' => 'summer20',
            'type' => PromotionType::COUPON->value,
            'discount_type' => PromotionDiscountType::PERCENTAGE->value,
            'discount_value' => 20,
            'branch_id' => $this->branchA1->id,
            'min_order_amount' => 600,
            'max_discount_amount' => 150,
            'max_uses' => 1,
            'is_active' => true,
        ])->assertCreated();

        // Fails on min order (500 < 600)
        $this->postJson('/api/promotions/evaluate', [
            'branch_id' => $this->branchA1->id,
            'coupon_code' => 'SUMMER20',
            'items' => [['product_id' => $this->shirt->id, 'quantity' => 1, 'unit_price' => 500]],
        ])->assertStatus(422);

        // Fails on wrong branch A2
        $this->postJson('/api/promotions/evaluate', [
            'branch_id' => $this->branchA2->id,
            'coupon_code' => 'SUMMER20',
            'items' => [['product_id' => $this->shirt->id, 'quantity' => 2, 'unit_price' => 500]],
        ])->assertStatus(422);

        // Succeeds on branch A1 with subtotal 1000 -> 20% = 200 capped at 150
        $eval = $this->postJson('/api/promotions/evaluate', [
            'branch_id' => $this->branchA1->id,
            'coupon_code' => 'SUMMER20',
            'items' => [['product_id' => $this->shirt->id, 'quantity' => 2, 'unit_price' => 500]],
        ])->assertOk();
        $this->assertEquals(150.0, (float) $eval->json('data.promotion_discount'));

        // Tenant B isolation: Tenant B cannot use Tenant A's coupon
        Sanctum::actingAs($this->ownerB);
        $productB = Product::create(['user_id' => $this->ownerB->id, 'name' => 'منتج B', 'code' => 'PB-1', 'type' => ProductType::STANDARD->value, 'purchase_price' => 100, 'regular_price' => 1000, 'sale_price' => 1000, 'quantity' => 20, 'unit' => 'قطعة']);
        $this->postJson('/api/promotions/evaluate', [
            'branch_id' => $this->branchB1->id,
            'coupon_code' => 'SUMMER20',
            'items' => [['product_id' => $productB->id, 'quantity' => 1, 'unit_price' => 1000]],
        ])->assertStatus(422);

        // Back to Tenant A: consume the 1 allowed use via invoice creation
        Sanctum::actingAs($this->ownerA);
        $inv1 = $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE->value,
            'branch_id' => $this->branchA1->id,
            'date' => now()->toDateString(),
            'coupon_code' => 'SUMMER20',
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 850,
            'items' => [['product_id' => $this->shirt->id, 'quantity' => 2, 'unit_price' => 500]],
        ])->assertCreated();
        $this->assertEquals(150.0, (float) $inv1->json('data.discount'));
        $this->assertEquals(850.0, (float) $inv1->json('data.total'));

        // 2nd attempt rejected because max_uses = 1 reached
        $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE->value,
            'branch_id' => $this->branchA1->id,
            'date' => now()->toDateString(),
            'coupon_code' => 'SUMMER20',
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 850,
            'items' => [['product_id' => $this->shirt->id, 'quantity' => 2, 'unit_price' => 500]],
        ])->assertStatus(422);

        // Deleting inv1 restores used_count back to 0 so coupon is reusable
        $this->deleteJson('/api/invoices/' . $inv1->json('data.id'))->assertOk();
        $this->assertEquals(0, Promotion::where('user_id', $this->ownerA->id)->first()->used_count);
    }

    public function test_buy_x_get_y_cashier_discount_bypass_and_prorated_return_price(): void
    {
        Setting::create(['user_id' => $this->ownerA->id, 'key' => SettingService::KEY_MAX_DISCOUNT_PERCENT, 'value' => '5']);

        $cashier = User::factory()->create([
            'owner_id' => $this->ownerA->id,
            'branch_id' => $this->branchA1->id,
            'role' => UserRole::CASHIER->value,
            'phone' => '01099000010',
            'status' => UserStatus::ACTIVE->value,
        ]);

        $drawer = Treasury::create([
            'user_id' => $this->ownerA->id,
            'branch_id' => $this->branchA1->id,
            'assigned_user_id' => $cashier->id,
            'name' => 'درج كاشير',
            'type' => TreasuryType::CASHIER_DRAWER->value,
            'balance' => 1000,
            'is_active' => true,
        ]);

        Shift::create([
            'user_id' => $this->ownerA->id,
            'created_by' => $cashier->id,
            'treasury_id' => $drawer->id,
            'shift_number' => 'SHF-PR-01',
            'status' => ShiftStatus::OPEN->value,
            'opened_at' => now(),
            'opening_balance' => 1000,
        ]);

        // Owner creates Buy 2 Get 1 Free (100% off cheapest item in category Apparel)
        Sanctum::actingAs($this->ownerA);
        $promoRes = $this->postJson('/api/promotions', [
            'name' => 'اشتري 2 والثالثة مجاناً',
            'type' => PromotionType::BUY_X_GET_Y->value,
            'discount_type' => PromotionDiscountType::PERCENTAGE->value,
            'discount_value' => 100,
            'buy_quantity' => 2,
            'get_quantity' => 1,
            'category_id' => $this->catApparel->id,
            'is_active' => true,
        ])->assertCreated();
        $promoId = (int) $promoRes->json('data.id');

        // Cashier evaluates cart: 2 shirts (500 each) + 1 socks (200) -> 200 discount (cheapest unit free = 16.67% > 5% cashier cap)
        Sanctum::actingAs($cashier);
        $eval = $this->postJson('/api/promotions/evaluate', [
            'branch_id' => $this->branchA1->id,
            'items' => [
                ['product_id' => $this->shirt->id, 'quantity' => 2, 'unit_price' => 500],
                ['product_id' => $this->socks->id, 'quantity' => 1, 'unit_price' => 200],
            ],
        ])->assertOk();
        $this->assertEquals(200.0, (float) $eval->json('data.promotion_discount'));

        // Cashier cannot add extra unauthorized manual discount above 5% (e.g. 200 promo + 100 manual -> 100 > 60 max)
        $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE->value,
            'branch_id' => $this->branchA1->id,
            'promotion_id' => $promoId,
            'apply_auto_promotion' => true,
            'discount' => 300,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 900,
            'items' => [
                ['product_id' => $this->shirt->id, 'quantity' => 2, 'unit_price' => 500],
                ['product_id' => $this->socks->id, 'quantity' => 1, 'unit_price' => 200],
            ],
        ])->assertStatus(422);

        // Cashier succeeds with official 200 promo discount (1000 net total)
        $sale = $this->postJson('/api/invoices', [
            'type' => InvoiceType::SALE->value,
            'branch_id' => $this->branchA1->id,
            'promotion_id' => $promoId,
            'apply_auto_promotion' => true,
            'discount' => 200,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 1000,
            'items' => [
                ['product_id' => $this->shirt->id, 'quantity' => 2, 'unit_price' => 500],
                ['product_id' => $this->socks->id, 'quantity' => 1, 'unit_price' => 200],
            ],
        ])->assertCreated();
        $invoiceNumber = $sale->json('data.invoice_number');

        // Returning this parent invoice returns prorated unit prices (discount 200 / subtotal 1200 = 1/6 off each unit)
        // Shirt 500 * (1000/1200) = 416.67, Socks 200 * (1000/1200) = 166.67
        $lookup = $this->getJson("/api/invoices/by-number/{$invoiceNumber}?for_return=1&return_type=SALE_RETURN")->assertOk();
        $items = collect($lookup->json('data.items'))->keyBy('product_id');
        $this->assertEquals(416.67, (float) $items[$this->shirt->id]['effective_return_unit_price']);
        $this->assertEquals(166.67, (float) $items[$this->socks->id]['effective_return_unit_price']);
    }

    public function test_woocommerce_coupon_order_does_not_double_deduct_discount(): void
    {
        $mockClient = Mockery::mock(WooCommerceApiClientInterface::class);
        $mockClient->shouldReceive('updateProductStock')->andReturn(true)->byDefault();
        $mockClient->shouldReceive('updateOrderStatus')->andReturn(true);
        $this->app->instance(WooCommerceApiClientInterface::class, $mockClient);

        $shirtWc = Product::create([
            'user_id' => $this->ownerA->id,
            'name' => 'تيشيرت ووكومرس',
            'code' => 'WC-TSHIRT',
            'wc_product_id' => 777,
            'type' => ProductType::STANDARD->value,
            'purchase_price' => 200,
            'regular_price' => 500,
            'sale_price' => 500,
            'quantity' => 20,
            'unit' => 'قطعة',
        ]);
        BranchStock::create(['branch_id' => $this->branchA1->id, 'product_id' => $shirtWc->id, 'quantity' => 20]);

        $party = Party::create([
            'user_id' => $this->ownerA->id,
            'name' => 'عميل أونلاين',
            'phone' => '01099000099',
            'type' => PartyType::CUSTOMER->value,
            'balance' => 0,
        ]);

        // WooCommerce line item with subtotal=1000 (pre-coupon), total=800 (post-coupon), price=400 (post-coupon)
        $order = OnlineOrder::create([
            'user_id' => $this->ownerA->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => 'WC-CPN-1',
            'external_order_number' => '#WC-CPN-1',
            'branch_id' => $this->branchA1->id,
            'party_id' => $party->id,
            'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'payment_method_label' => 'cod',
            'shipping_cost' => 50,
            'subtotal' => 1000,
            'discount_total' => 200,
            'total' => 850,
            'coupon_codes' => ['WC20'],
            'customer_name' => 'عميل أونلاين',
            'customer_phone' => '01099000099',
            'items_snapshot' => [
                [
                    'product_id' => 777,
                    'name' => 'تيشيرت ووكومرس',
                    'quantity' => 2,
                    'subtotal' => '1000.00',
                    'total' => '800.00',
                    'price' => 400,
                ],
            ],
        ]);

        $invoice = app(OnlineOrderSyncService::class)->deliverOrder($this->ownerA, $order, [
            'collected_amount' => 850,
            'payment_method' => PaymentMethod::CASH->value,
        ]);

        $this->assertEquals(1000.0, (float) $invoice->subtotal);
        $this->assertEquals(200.0, (float) $invoice->discount);
        $this->assertEquals(850.0, (float) $invoice->total);
        $this->assertSame('WC20', $invoice->coupon_code);
        $this->assertEquals(200.0, (float) $invoice->promotion_discount);
    }
}
