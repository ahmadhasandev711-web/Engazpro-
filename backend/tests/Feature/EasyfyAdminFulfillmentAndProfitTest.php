<?php

namespace Tests\Feature;

use App\Enums\AdminAuditAction;
use App\Enums\Easyfy\EasyfyOrderStatus;
use App\Enums\Easyfy\EasyfyPaymentMethod;
use App\Enums\Easyfy\EasyfyPaymentStatus;
use App\Enums\Easyfy\EasyfyStockMode;
use App\Enums\Easyfy\EasyfyStockMovementType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Mail\EasyfyNewOrderAdminMail;
use App\Models\Easyfy\EasyfyCategory;
use App\Models\Easyfy\EasyfyOrder;
use App\Models\Easyfy\EasyfyProduct;
use App\Models\Easyfy\EasyfyProductVariant;
use App\Models\Easyfy\EasyfyStoreSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EasyfyAdminFulfillmentAndProfitTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');
        Mail::fake();

        $this->admin = User::factory()->create([
            'name' => 'Super Admin',
            'phone' => '01000000000',
            'role' => UserRole::OWNER->value,
            'status' => UserStatus::ACTIVE->value,
        ]);
        $this->admin->is_admin = true;
        $this->admin->save();

        $this->owner = User::factory()->create([
            'name' => 'تاجر الإسكندرية',
            'phone' => '01022223333',
            'role' => UserRole::OWNER->value,
            'status' => UserStatus::ACTIVE->value,
        ]);

        EasyfyStoreSetting::create(['key' => 'store_enabled', 'value' => '1']);
        EasyfyStoreSetting::create(['key' => 'cod_enabled', 'value' => '1']);
        EasyfyStoreSetting::create(['key' => 'instapay_enabled', 'value' => '1']);
        EasyfyStoreSetting::create(['key' => 'vodafone_cash_enabled', 'value' => '1']);
        EasyfyStoreSetting::create(['key' => 'default_shipping_fee', 'value' => '50']);
        EasyfyStoreSetting::create(['key' => 'admin_notification_email', 'value' => 'ops@easyfy.cloud']);
    }

    public function test_admin_can_create_product_tiers_images_and_adjust_inventory(): void
    {
        Sanctum::actingAs($this->admin);

        $catId = (int) $this->postJson('/api/admin/easyfy/categories', [
            'name' => 'ملصقات حرارية',
            'is_active' => true,
        ])->assertStatus(201)->json('data.id');

        $productRes = $this->postJson('/api/admin/easyfy/products', [
            'category_id' => $catId,
            'name' => 'رول استيكر باركود 50x30',
            'stock_mode' => EasyfyStockMode::TRACKED->value,
            'is_active' => true,
            'variants' => [[
                'sku' => 'LBL-5030',
                'label' => '1000 ملصق',
                'cost_price' => 40,
                'selling_price' => 75,
                'stock_quantity' => 20,
                'low_stock_threshold' => 5,
                'price_tiers' => [
                    ['min_qty' => 10, 'unit_price' => 65],
                ],
            ]],
        ])->assertStatus(201);

        $productId = (int) $productRes->json('data.id');
        $variantId = (int) $productRes->json('data.variants.0.id');

        $imgRes = $this->post("/api/admin/easyfy/products/{$productId}/images", [
            'image' => UploadedFile::fake()->image('label-roll.png'),
            'is_primary' => true,
        ])->assertStatus(201);

        $imagePath = $imgRes->json('data.image_path');
        $this->assertStringStartsWith('http', $imagePath);
        $urlPath = (string) parse_url($imagePath, PHP_URL_PATH);
        Storage::disk('public')->assertExists(ltrim(str_replace('/storage/', '', $urlPath), '/'));
        $this->get($urlPath)->assertOk();

        $this->postJson("/api/admin/easyfy/inventory/{$variantId}/adjust", [
            'type' => EasyfyStockMovementType::RESTOCK->value,
            'quantity_delta' => 30,
            'unit_cost' => 38,
            'notes' => 'توريد دفعة جديدة',
        ])->assertOk()->assertJsonPath('data.stock_quantity', 50);

        $this->assertDatabaseHas('easyfy_stock_movements', [
            'variant_id' => $variantId,
            'type' => EasyfyStockMovementType::RESTOCK->value,
            'quantity_delta' => 30,
            'balance_after' => 50,
        ]);
        $this->assertDatabaseHas('admin_audit_logs', ['action' => AdminAuditAction::EASYFY_STOCK_ADJUSTED->value]);
    }

    public function test_admin_payment_verification_rejection_and_merchant_reupload_workflow(): void
    {
        $product = EasyfyProduct::create([
            'name' => 'أكياس شحن مبطنة', 'slug' => 'padded-bags',
            'stock_mode' => EasyfyStockMode::UNLIMITED->value, 'is_active' => true,
        ]);
        $variant = EasyfyProductVariant::create([
            'product_id' => $product->id, 'sku' => 'PB-100', 'label' => '100 كيس',
            'cost_price' => 120, 'selling_price' => 200, 'is_active' => true,
        ]);

        Sanctum::actingAs($this->owner);
        $this->postJson('/api/easyfy/cart/items', ['variant_id' => $variant->id, 'quantity' => 2])->assertOk();
        $orderId = (int) $this->post('/api/easyfy/orders', [
            'recipient_name' => 'عمر',
            'recipient_phone' => '01022223333',
            'governorate' => 'القاهرة',
            'shipping_address' => 'المعادي',
            'payment_method' => EasyfyPaymentMethod::VODAFONE_CASH->value,
            'transfer_reference' => 'VFC-111',
            'payment_proof' => UploadedFile::fake()->image('blurry.png'),
        ])->assertStatus(201)->json('data.id');

        // Admin rejects blurry screenshot
        Sanctum::actingAs($this->admin);
        $this->postJson("/api/admin/easyfy/orders/{$orderId}/reject-payment", [
            'reason' => 'صورة التحويل غير واضحة، يرجى إعادة الرفع',
        ])->assertOk()
            ->assertJsonPath('data.payment_verification_status', EasyfyPaymentStatus::REJECTED->value);

        // Merchant re-uploads clear screenshot => resets to PENDING_REVIEW and sends alert email
        Sanctum::actingAs($this->owner);
        $this->post("/api/easyfy/orders/{$orderId}/reupload-proof", [
            'transfer_reference' => 'VFC-222',
            'payment_proof' => UploadedFile::fake()->image('clear.png'),
        ])->assertOk()
            ->assertJsonPath('data.payment_verification_status', EasyfyPaymentStatus::PENDING_REVIEW->value)
            ->assertJsonPath('data.transfer_reference', 'VFC-222');

        Mail::assertSent(EasyfyNewOrderAdminMail::class, 2);

        // Admin verifies payment => auto-confirms order from PENDING -> CONFIRMED
        Sanctum::actingAs($this->admin);
        $this->postJson("/api/admin/easyfy/orders/{$orderId}/verify-payment")
            ->assertOk()
            ->assertJsonPath('data.payment_verification_status', EasyfyPaymentStatus::VERIFIED->value)
            ->assertJsonPath('data.status', EasyfyOrderStatus::CONFIRMED->value);

        $this->assertDatabaseHas('admin_audit_logs', ['action' => AdminAuditAction::EASYFY_PAYMENT_REJECTED->value]);
        $this->assertDatabaseHas('admin_audit_logs', ['action' => AdminAuditAction::EASYFY_PAYMENT_VERIFIED->value]);
    }

    public function test_admin_order_lifecycle_cancel_stock_restore_cost_override_and_overview_analytics(): void
    {
        $tracked = EasyfyProduct::create([
            'name' => 'شريط لاصق شفاف', 'slug' => 'tape-clear',
            'stock_mode' => EasyfyStockMode::TRACKED->value, 'is_active' => true,
        ]);
        $trackedVar = EasyfyProductVariant::create([
            'product_id' => $tracked->id, 'sku' => 'TAPE-6', 'label' => 'باكت 6 بكرات',
            'cost_price' => 90, 'selling_price' => 140, 'stock_quantity' => 30, 'is_active' => true,
        ]);

        $custom = EasyfyProduct::create([
            'name' => 'كراتين مطبوعة حسب الطلب', 'slug' => 'custom-box',
            'stock_mode' => EasyfyStockMode::MADE_TO_ORDER->value, 'is_active' => true,
        ]);
        $customVar = EasyfyProductVariant::create([
            'product_id' => $custom->id, 'sku' => 'CBOX-1', 'label' => '500 كرتونة',
            'cost_price' => 0, 'selling_price' => 2500, 'is_active' => true,
        ]);

        // Order 1 (COD, custom made-to-order + tracked)
        Sanctum::actingAs($this->owner);
        $this->postJson('/api/easyfy/cart/items', ['variant_id' => $customVar->id, 'quantity' => 1])->assertOk();
        $order1Id = (int) $this->postJson('/api/easyfy/orders', [
            'recipient_name' => 'عمر',
            'recipient_phone' => '01022223333',
            'governorate' => 'القاهرة',
            'shipping_address' => 'المعادي',
            'payment_method' => EasyfyPaymentMethod::CASH_ON_DELIVERY->value,
        ])->assertStatus(201)->json('data.id');

        // Order 2 (COD, tracked 10 qty => will cancel to verify stock restoration)
        $this->postJson('/api/easyfy/cart/items', ['variant_id' => $trackedVar->id, 'quantity' => 10])->assertOk();
        $order2Id = (int) $this->postJson('/api/easyfy/orders', [
            'recipient_name' => 'عمر',
            'recipient_phone' => '01022223333',
            'governorate' => 'القاهرة',
            'shipping_address' => 'المعادي',
            'payment_method' => EasyfyPaymentMethod::CASH_ON_DELIVERY->value,
        ])->assertStatus(201)->json('data.id');

        $this->assertEquals(20, $trackedVar->fresh()->stock_quantity);

        Sanctum::actingAs($this->admin);

        // Cancel order 2 => restores 10 to stock (back to 30) and blocks any subsequent transition
        $this->patchJson("/api/admin/easyfy/orders/{$order2Id}/status", [
            'status' => EasyfyOrderStatus::CANCELLED->value,
            'note' => 'إلغاء بطلب العميل',
        ])->assertOk()->assertJsonPath('data.status', EasyfyOrderStatus::CANCELLED->value);

        $this->assertEquals(30, $trackedVar->fresh()->stock_quantity);
        $this->patchJson("/api/admin/easyfy/orders/{$order2Id}/status", [
            'status' => EasyfyOrderStatus::CONFIRMED->value,
        ])->assertStatus(422);

        // Update actual supplier unit cost on Order 1 custom item: revenue = 2500 (items), cost = 1750 => profit = 750
        $order1 = EasyfyOrder::with('items')->findOrFail($order1Id);
        $itemId = $order1->items->first()->id;
        $this->patchJson("/api/admin/easyfy/orders/{$order1Id}/costs", [
            'items' => [['order_item_id' => $itemId, 'unit_cost' => 1750]],
        ])->assertOk()
            ->assertJsonPath('data.total_cost', 1750)
            ->assertJsonPath('data.gross_profit', 750);

        // Transition Order 1 through lifecycle to DELIVERED
        $this->patchJson("/api/admin/easyfy/orders/{$order1Id}/status", ['status' => EasyfyOrderStatus::CONFIRMED->value])->assertOk();
        $this->patchJson("/api/admin/easyfy/orders/{$order1Id}/status", ['status' => EasyfyOrderStatus::PREPARING->value])->assertOk();
        $this->patchJson("/api/admin/easyfy/orders/{$order1Id}/status", [
            'status' => EasyfyOrderStatus::SHIPPED->value,
            'courier_name' => 'أرامكس',
            'tracking_number' => 'ARX-7712',
        ])->assertOk()->assertJsonPath('data.tracking_number', 'ARX-7712');
        $this->patchJson("/api/admin/easyfy/orders/{$order1Id}/status", ['status' => EasyfyOrderStatus::DELIVERED->value])->assertOk();

        // Check command center overview & demand report (only non-cancelled order 1 counted)
        $this->getJson('/api/admin/overview')
            ->assertOk()
            ->assertJsonPath('data.easyfy_store.orders_count', 1)
            ->assertJsonPath('data.easyfy_store.gross_revenue', 2550)
            ->assertJsonPath('data.easyfy_store.total_cost', 1750)
            ->assertJsonPath('data.easyfy_store.gross_profit', 750);

        $this->getJson('/api/admin/easyfy/analytics/demand')
            ->assertOk()
            ->assertJsonPath('data.unlimited_and_custom_demand.0.product_name', 'كراتين مطبوعة حسب الطلب');
    }
}
