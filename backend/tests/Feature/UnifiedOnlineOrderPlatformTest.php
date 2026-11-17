<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\EcommercePlatform;
use App\Enums\PartyType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Branch;
use App\Models\OnlineOrder;
use App\Models\OnlineOrderItem;
use App\Models\Party;
use App\Models\Product;
use App\Models\ShopifyIntegration;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\OnlineOrders\OnlineOrderStockReservationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UnifiedOnlineOrderPlatformTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'صاحب متجر متعدد المنصات',
            'phone' => '01099887766',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER,
            'status' => UserStatus::ACTIVE,
        ]);
        $this->owner->forceFill(['ecommerce_enabled' => true])->save();

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ANNUAL',
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'المخزن الموحد',
            'code' => 'MAIN',
            'type' => BranchType::STORE,
            'is_main' => true,
            'is_active' => true,
        ]);

        WooCommerceIntegration::create([
            'user_id' => $this->owner->id,
            'store_url' => 'https://woo.example.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'is_active' => true,
        ]);
    }

    public function test_online_orders_index_and_show_support_unified_platforms_and_tenant_isolation(): void
    {
        $wooOrder = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '101',
            'external_order_number' => '#101',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'customer_name' => 'عميل ووكومرس',
            'customer_phone' => '01011111111',
            'total' => '250.00',
        ]);

        $shopifyOrder = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::SHOPIFY,
            'external_order_id' => '99887766',
            'external_order_number' => '#SH-1002',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::CONFIRMED,
            'payment_status' => WcPaymentStatus::PAID_ONLINE,
            'customer_name' => 'عميل شوبيفاي',
            'customer_phone' => '01022222222',
            'total' => '450.00',
        ]);

        // Default index scopes to active platform (WOOCOMMERCE here)
        $resDefault = $this->actingAs($this->owner)->getJson('/api/online-orders');
        $resDefault->assertOk();
        $this->assertCount(1, $resDefault->json('data.data'));
        $this->assertSame('#101', $resDefault->json('data.data.0.display_reference'));

        // Explicit platform=SHOPIFY filter returns Shopify order
        $resShopify = $this->actingAs($this->owner)->getJson('/api/online-orders?platform=' . EcommercePlatform::SHOPIFY->value);
        $resShopify->assertOk();
        $this->assertCount(1, $resShopify->json('data.data'));
        $this->assertSame('#SH-1002', $resShopify->json('data.data.0.display_reference'));

        // Show endpoint works uniformly for both IDs
        $this->actingAs($this->owner)
            ->getJson("/api/online-orders/{$wooOrder->id}")
            ->assertOk()
            ->assertJsonPath('data.platform', EcommercePlatform::WOOCOMMERCE->value);

        $this->actingAs($this->owner)
            ->getJson("/api/online-orders/{$shopifyOrder->id}")
            ->assertOk()
            ->assertJsonPath('data.platform', EcommercePlatform::SHOPIFY->value)
            ->assertJsonPath('data.display_reference', '#SH-1002');
    }

    public function test_courier_manifest_combines_and_filters_woocommerce_and_shopify_shipments(): void
    {
        $courier = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'شركة أرامكس',
            'type' => PartyType::COURIER,
            'phone' => '01033334444',
            'balance' => 0,
        ]);

        OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '201',
            'external_order_number' => '#WC-201',
            'branch_id' => $this->branch->id,
            'courier_party_id' => $courier->id,
            'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'customer_name' => 'شحنة ووكومرس',
            'total' => '300.00',
            'shipping_cost' => '40.00',
        ]);

        OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::SHOPIFY,
            'external_order_id' => '202',
            'external_order_number' => '#SH-202',
            'branch_id' => $this->branch->id,
            'courier_party_id' => $courier->id,
            'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
            'payment_status' => WcPaymentStatus::PAID_ONLINE,
            'customer_name' => 'شحنة شوبيفاي',
            'total' => '500.00',
            'shipping_cost' => '50.00',
        ]);

        // Combined manifest returns both WooCommerce and Shopify shipments
        $allRes = $this->actingAs($this->owner)
            ->getJson("/api/couriers/{$courier->id}/manifest?source=ONLINE_ORDER");
        $allRes->assertOk();
        $this->assertCount(2, $allRes->json('shipments'));

        // Platform-specific source filters separate them cleanly
        $wooRes = $this->actingAs($this->owner)
            ->getJson("/api/couriers/{$courier->id}/manifest?source=" . EcommercePlatform::WOOCOMMERCE->value);
        $wooRes->assertOk();
        $this->assertCount(1, $wooRes->json('shipments'));
        $this->assertSame(EcommercePlatform::WOOCOMMERCE->value, $wooRes->json('shipments.0.platform'));

        $shopifyRes = $this->actingAs($this->owner)
            ->getJson("/api/couriers/{$courier->id}/manifest?source=" . EcommercePlatform::SHOPIFY->value);
        $shopifyRes->assertOk();
        $this->assertCount(1, $shopifyRes->json('shipments'));
        $this->assertSame(EcommercePlatform::SHOPIFY->value, $shopifyRes->json('shipments.0.platform'));
    }

    public function test_stock_reservation_aggregates_across_woocommerce_and_shopify_orders(): void
    {
        ShopifyIntegration::create([
            'user_id' => $this->owner->id,
            'shop_domain' => 'unified-test.myshopify.com',
            'access_token' => 'shpat_test',
            'is_active' => false,
        ]);

        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'منتج مشترك بين المنصتين',
            'price' => 100,
            'cost_price' => 50,
            'quantity' => 20,
        ]);

        $wooOrder = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::WOOCOMMERCE,
            'external_order_id' => '301',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'total' => '200.00',
        ]);

        OnlineOrderItem::create([
            'user_id' => $this->owner->id,
            'online_order_id' => $wooOrder->id,
            'product_id' => $product->id,
            'quantity' => '2.00',
        ]);

        $shopifyOrder = OnlineOrder::create([
            'user_id' => $this->owner->id,
            'platform' => EcommercePlatform::SHOPIFY,
            'external_order_id' => '302',
            'branch_id' => $this->branch->id,
            'status' => WcOrderStatus::CONFIRMED,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'total' => '300.00',
        ]);

        OnlineOrderItem::create([
            'user_id' => $this->owner->id,
            'online_order_id' => $shopifyOrder->id,
            'product_id' => $product->id,
            'quantity' => '3.00',
        ]);

        $reserved = app(OnlineOrderStockReservationService::class)->reservedQuantity(
            $this->owner->id,
            $product->id,
            null,
            [$this->branch->id]
        );

        $this->assertSame('5.00', $reserved->toDecimalString());
    }
}
