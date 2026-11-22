<?php

namespace Tests\Feature;

use App\Enums\Easyfy\EasyfyCouponType;
use App\Enums\Easyfy\EasyfyOrderStatus;
use App\Enums\Easyfy\EasyfyPaymentMethod;
use App\Enums\Easyfy\EasyfyPaymentStatus;
use App\Enums\Easyfy\EasyfyStockMode;
use App\Enums\Easyfy\EasyfyStockMovementType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Mail\EasyfyNewOrderAdminMail;
use App\Models\Easyfy\EasyfyCategory;
use App\Models\Easyfy\EasyfyCoupon;
use App\Models\Easyfy\EasyfyOrder;
use App\Models\Easyfy\EasyfyProduct;
use App\Models\Easyfy\EasyfyProductVariant;
use App\Models\Easyfy\EasyfyShippingZone;
use App\Models\Easyfy\EasyfyStoreSetting;
use App\Models\Easyfy\EasyfyVariantPriceTier;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EasyfyStoreCheckoutAndInventoryTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $cashier;
    private EasyfyCategory $category;
    private EasyfyProduct $trackedProduct;
    private EasyfyProductVariant $trackedVariant;
    private EasyfyProduct $unlimitedProduct;
    private EasyfyProductVariant $unlimitedVariant;
    private EasyfyProduct $customProduct;
    private EasyfyProductVariant $customVariant;
    private EasyfyShippingZone $cairoZone;
    private EasyfyShippingZone $alexZone;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');
        Mail::fake();

        $this->owner = User::factory()->create([
            'name' => 'أحمد التاجر',
            'phone' => '01011112222',
            'role' => UserRole::OWNER->value,
            'status' => UserStatus::ACTIVE->value,
        ]);

        $this->cashier = User::factory()->create([
            'owner_id' => $this->owner->id,
            'name' => 'محمود الكاشير',
            'phone' => '01033334444',
            'role' => UserRole::CASHIER->value,
            'status' => UserStatus::ACTIVE->value,
        ]);

        $this->seedCatalogAndSettings();
    }

    public function test_volume_pricing_tiers_shipping_threshold_and_coupon_calculation(): void
    {
        Sanctum::actingAs($this->owner);

        // 10 boxes => unit price = 50.00 => subtotal = 500.00 (< threshold 1000) => shipping 60.00
        $this->postJson('/api/easyfy/cart/items', [
            'variant_id' => $this->trackedVariant->id,
            'quantity' => 10,
        ])->assertOk()
            ->assertJsonPath('data.subtotal', 500)
            ->assertJsonPath('data.items.0.unit_price', 50);

        $this->postJson('/api/easyfy/checkout/preview', [
            'shipping_zone_id' => $this->cairoZone->id,
        ])->assertOk()
            ->assertJsonPath('data.subtotal', 500)
            ->assertJsonPath('data.shipping_fee', 60)
            ->assertJsonPath('data.total_amount', 560);

        // Increase to 25 boxes => tier >= 20 => unit price = 45.00 => subtotal = 1125 (>= threshold 1000) => free shipping!
        $cartItemId = (int) $this->getJson('/api/easyfy/cart')->json('data.items.0.id');
        $this->putJson("/api/easyfy/cart/items/{$cartItemId}", [
            'quantity' => 25,
        ])->assertOk()
            ->assertJsonPath('data.subtotal', 1125)
            ->assertJsonPath('data.items.0.unit_price', 45);

        EasyfyCoupon::create([
            'code' => 'SAVE10',
            'discount_type' => EasyfyCouponType::PERCENTAGE->value,
            'discount_value' => 10,
            'max_discount_amount' => 100,
            'max_uses_per_account' => 1,
            'is_active' => true,
        ]);

        // 10% of 1125 = 112.5 capped at 100 => total = 1025
        $this->postJson('/api/easyfy/checkout/preview', [
            'shipping_zone_id' => $this->cairoZone->id,
            'coupon_code' => 'save10',
        ])->assertOk()
            ->assertJsonPath('data.subtotal', 1125)
            ->assertJsonPath('data.shipping_fee', 0)
            ->assertJsonPath('data.discount_amount', 100)
            ->assertJsonPath('data.coupon_code', 'SAVE10')
            ->assertJsonPath('data.total_amount', 1025);
    }

    public function test_checkout_with_cod_deducts_tracked_stock_enforces_idempotency_and_records_dual_identity(): void
    {
        Sanctum::actingAs($this->cashier);

        // Exceed available stock (50) => 422
        $this->postJson('/api/easyfy/cart/items', [
            'variant_id' => $this->trackedVariant->id,
            'quantity' => 55,
        ])->assertStatus(422);

        $this->postJson('/api/easyfy/cart/items', [
            'variant_id' => $this->trackedVariant->id,
            'quantity' => 5,
        ])->assertOk();

        // Also add UNLIMITED item
        $this->postJson('/api/easyfy/cart/items', [
            'variant_id' => $this->unlimitedVariant->id,
            'quantity' => 3,
        ])->assertOk();

        $payload = [
            'recipient_name' => 'مخزن التجمع',
            'recipient_phone' => '01099887766',
            'shipping_zone_id' => $this->alexZone->id,
            'governorate' => 'الإسكندرية',
            'shipping_address' => 'سموحة - شارع فوزي معاذ',
            'payment_method' => EasyfyPaymentMethod::CASH_ON_DELIVERY->value,
            'idempotency_key' => 'idem-key-001',
        ];

        $firstResp = $this->postJson('/api/easyfy/orders', $payload)->assertStatus(201);
        $firstOrderId = $firstResp->json('data.id');

        $firstResp->assertJsonPath('data.order_number', 'ESF-00001')
            ->assertJsonPath('data.payment_verification_status', EasyfyPaymentStatus::NOT_REQUIRED->value)
            ->assertJsonPath('data.owner_name', $this->owner->name)
            ->assertJsonPath('data.owner_phone', $this->owner->phone)
            ->assertJsonPath('data.ordered_by_name', $this->cashier->name)
            ->assertJsonPath('data.ordered_by_phone', $this->cashier->phone)
            ->assertJsonPath('data.ordered_by_role', UserRole::CASHIER->value);

        // Retry with same idempotency_key returns same order without deducting stock twice
        $this->postJson('/api/easyfy/orders', $payload)
            ->assertStatus(201)
            ->assertJsonPath('data.id', $firstOrderId)
            ->assertJsonPath('data.order_number', 'ESF-00001');

        $this->trackedVariant->refresh();
        $this->assertEquals(45, $this->trackedVariant->stock_quantity);

        $this->assertDatabaseHas('easyfy_stock_movements', [
            'variant_id' => $this->trackedVariant->id,
            'reference_order_id' => $firstOrderId,
            'type' => EasyfyStockMovementType::ORDER_DEDUCTION->value,
            'quantity_delta' => -5,
            'balance_after' => 45,
        ]);

        Mail::assertSent(EasyfyNewOrderAdminMail::class, 1);
    }

    public function test_instapay_checkout_requires_proof_and_saves_private_proof_and_artwork_for_made_to_order(): void
    {
        Sanctum::actingAs($this->owner);

        $cartRes = $this->postJson('/api/easyfy/cart/items', [
            'variant_id' => $this->customVariant->id,
            'quantity' => 100,
            'custom_note' => 'طباعة لونين أسود وذهبي',
        ])->assertOk();

        $itemId = (int) $cartRes->json('data.items.0.id');
        $artwork = UploadedFile::fake()->image('brand-logo.png', 200, 200);

        $this->post("/api/easyfy/cart/items/{$itemId}/artwork", [
            'artwork' => $artwork,
        ])->assertOk()->assertJsonPath('data.items.0.has_artwork', true);

        // Missing transfer reference & proof for INSTAPAY => 422
        $this->postJson('/api/easyfy/orders', [
            'recipient_name' => 'أحمد',
            'recipient_phone' => '01011112222',
            'shipping_zone_id' => $this->cairoZone->id,
            'governorate' => 'القاهرة',
            'shipping_address' => 'مدينة نصر',
            'payment_method' => EasyfyPaymentMethod::INSTAPAY->value,
        ])->assertStatus(422);

        $proof = UploadedFile::fake()->image('instapay-receipt.jpg', 300, 500);
        $orderRes = $this->post('/api/easyfy/orders', [
            'recipient_name' => 'أحمد',
            'recipient_phone' => '01011112222',
            'shipping_zone_id' => $this->cairoZone->id,
            'governorate' => 'القاهرة',
            'shipping_address' => 'مدينة نصر',
            'payment_method' => EasyfyPaymentMethod::INSTAPAY->value,
            'transfer_reference' => 'IPA-998811',
            'payment_proof' => $proof,
        ])->assertStatus(201);

        $order = EasyfyOrder::with('items')->findOrFail($orderRes->json('data.id'));
        $this->assertEquals(EasyfyPaymentStatus::PENDING_REVIEW, $order->payment_verification_status);
        $this->assertNotNull($order->payment_proof_path);
        $this->assertNotNull($order->items->first()->artwork_path);

        Storage::disk('local')->assertExists($order->payment_proof_path);
        Storage::disk('local')->assertExists($order->items->first()->artwork_path);

        Mail::assertSent(EasyfyNewOrderAdminMail::class, fn ($m) => $m->order->id === $order->id);
    }

    public function test_coupon_per_account_limit_free_shipping_and_store_addresses_with_staff_reorder(): void
    {
        Sanctum::actingAs($this->owner);

        // Create two addresses and confirm default switch
        $addr1 = $this->postJson('/api/easyfy/addresses', [
            'label' => 'الفرع الرئيسي',
            'recipient_name' => 'أحمد',
            'recipient_phone' => '01011112222',
            'shipping_zone_id' => $this->cairoZone->id,
            'governorate' => 'القاهرة',
            'address_line' => 'شارع التسعين',
            'is_default' => true,
        ])->assertStatus(201)->json('data.id');

        $this->postJson('/api/easyfy/addresses', [
            'label' => 'المخزن الجديد',
            'recipient_name' => 'سعيد',
            'recipient_phone' => '01055556666',
            'shipping_zone_id' => $this->alexZone->id,
            'governorate' => 'الإسكندرية',
            'address_line' => 'برج العرب',
            'is_default' => true,
        ])->assertStatus(201);

        $this->assertDatabaseHas('easyfy_store_addresses', ['id' => $addr1, 'is_default' => false]);

        EasyfyCoupon::create([
            'code' => 'FREESHIP',
            'discount_type' => EasyfyCouponType::FREE_SHIPPING->value,
            'discount_value' => 0,
            'max_uses_per_account' => 1,
            'is_active' => true,
        ]);

        $this->postJson('/api/easyfy/cart/items', ['variant_id' => $this->trackedVariant->id, 'quantity' => 2])->assertOk();
        $this->postJson('/api/easyfy/orders', [
            'recipient_name' => 'سعيد',
            'recipient_phone' => '01055556666',
            'shipping_zone_id' => $this->alexZone->id,
            'governorate' => 'الإسكندرية',
            'shipping_address' => 'برج العرب',
            'coupon_code' => 'FREESHIP',
            'payment_method' => EasyfyPaymentMethod::CASH_ON_DELIVERY->value,
        ])->assertStatus(201)
            ->assertJsonPath('data.shipping_fee', 95)
            ->assertJsonPath('data.discount_amount', 95)
            ->assertJsonPath('data.total_amount', 100);

        $orderId = (int) $this->getJson('/api/easyfy/orders')->json('data.0.id');

        // Cashier in same store sees owner's order and can 1-click reorder, but cannot reuse single-use FREESHIP coupon
        Sanctum::actingAs($this->cashier);
        $this->getJson('/api/easyfy/orders')
            ->assertOk()
            ->assertJsonPath('data.0.id', $orderId);

        $this->postJson("/api/easyfy/orders/{$orderId}/reorder")
            ->assertOk()
            ->assertJsonPath('data.items.0.variant_id', $this->trackedVariant->id);

        $this->postJson('/api/easyfy/orders', [
            'recipient_name' => 'محمود',
            'recipient_phone' => '01033334444',
            'shipping_zone_id' => $this->alexZone->id,
            'governorate' => 'الإسكندرية',
            'shipping_address' => 'برج العرب',
            'coupon_code' => 'FREESHIP',
            'payment_method' => EasyfyPaymentMethod::CASH_ON_DELIVERY->value,
        ])->assertStatus(422);
    }

    private function seedCatalogAndSettings(): void
    {
        EasyfyStoreSetting::create(['key' => 'store_enabled', 'value' => '1']);
        EasyfyStoreSetting::create(['key' => 'cod_enabled', 'value' => '1']);
        EasyfyStoreSetting::create(['key' => 'instapay_enabled', 'value' => '1']);
        EasyfyStoreSetting::create(['key' => 'vodafone_cash_enabled', 'value' => '1']);
        EasyfyStoreSetting::create(['key' => 'default_shipping_fee', 'value' => '75']);
        EasyfyStoreSetting::create(['key' => 'free_shipping_threshold', 'value' => '1000']);
        EasyfyStoreSetting::create(['key' => 'admin_notification_email', 'value' => 'admin@easyfy.cloud']);

        $this->cairoZone = EasyfyShippingZone::create([
            'governorate_name' => 'القاهرة والجيزة',
            'shipping_fee' => 60,
            'estimated_days' => '1-2 أيام',
            'is_active' => true,
        ]);

        $this->alexZone = EasyfyShippingZone::create([
            'governorate_name' => 'الإسكندرية',
            'shipping_fee' => 95,
            'estimated_days' => '2-3 أيام',
            'is_active' => true,
        ]);

        $this->category = EasyfyCategory::create(['name' => 'كراتين الشحن', 'slug' => 'shipping-boxes', 'is_active' => true]);

        $this->trackedProduct = EasyfyProduct::create([
            'category_id' => $this->category->id, 'name' => 'كرتونة شحن وسط', 'slug' => 'box-medium',
            'stock_mode' => EasyfyStockMode::TRACKED->value, 'is_active' => true, 'is_featured' => true,
        ]);
        $this->trackedVariant = EasyfyProductVariant::create([
            'product_id' => $this->trackedProduct->id, 'sku' => 'BOX-M', 'label' => '30x20x15 سم (ربطة 10)',
            'cost_price' => 35, 'selling_price' => 50, 'stock_quantity' => 50, 'low_stock_threshold' => 10, 'is_active' => true,
        ]);
        EasyfyVariantPriceTier::create(['variant_id' => $this->trackedVariant->id, 'min_qty' => 20, 'unit_price' => 45]);

        $this->unlimitedProduct = EasyfyProduct::create([
            'category_id' => $this->category->id, 'name' => 'رول بابلز تغليف', 'slug' => 'bubble-roll',
            'stock_mode' => EasyfyStockMode::UNLIMITED->value, 'is_active' => true,
        ]);
        $this->unlimitedVariant = EasyfyProductVariant::create([
            'product_id' => $this->unlimitedProduct->id, 'sku' => 'BBL-50', 'label' => '50 متر',
            'cost_price' => 180, 'selling_price' => 250, 'stock_quantity' => 0, 'is_active' => true,
        ]);

        $this->customProduct = EasyfyProduct::create([
            'category_id' => $this->category->id, 'name' => 'شنط مطبوعة باللوجو', 'slug' => 'printed-bags',
            'stock_mode' => EasyfyStockMode::MADE_TO_ORDER->value, 'allow_custom_note' => true,
            'allow_artwork_upload' => true, 'lead_time_days' => 5, 'is_active' => true,
        ]);
        $this->customVariant = EasyfyProductVariant::create([
            'product_id' => $this->customProduct->id, 'sku' => 'BAG-35', 'label' => '35x45 سم',
            'cost_price' => 0, 'selling_price' => 12, 'stock_quantity' => 0, 'is_active' => true,
        ]);
    }
}
