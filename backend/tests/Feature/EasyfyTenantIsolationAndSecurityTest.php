<?php

namespace Tests\Feature;

use App\Enums\AdminAuditAction;
use App\Enums\Easyfy\EasyfyPaymentMethod;
use App\Enums\Easyfy\EasyfyStockMode;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Easyfy\EasyfyOrder;
use App\Models\Easyfy\EasyfyProduct;
use App\Models\Easyfy\EasyfyProductVariant;
use App\Models\Easyfy\EasyfyStoreAddress;
use App\Models\Easyfy\EasyfyStoreSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EasyfyTenantIsolationAndSecurityTest extends TestCase
{
    use RefreshDatabase;

    private User $tenantAOwner;
    private User $tenantAMandob;
    private User $tenantBOwner;
    private EasyfyOrder $tenantAOrder;
    private EasyfyStoreAddress $tenantAAddress;
    private EasyfyProduct $product;
    private EasyfyProductVariant $variant;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');
        Mail::fake();

        $this->tenantAOwner = User::factory()->create([
            'name' => 'مالك متجر أ',
            'phone' => '01010000001',
            'role' => UserRole::OWNER->value,
            'status' => UserStatus::ACTIVE->value,
        ]);

        $this->tenantAMandob = User::factory()->create([
            'owner_id' => $this->tenantAOwner->id,
            'name' => 'مندوب متجر أ',
            'phone' => '01010000002',
            'role' => UserRole::MANDOB->value,
            'status' => UserStatus::ACTIVE->value,
        ]);

        $this->tenantBOwner = User::factory()->create([
            'name' => 'مالك متجر ب',
            'phone' => '01020000001',
            'role' => UserRole::OWNER->value,
            'status' => UserStatus::ACTIVE->value,
        ]);

        EasyfyStoreSetting::create(['key' => 'store_enabled', 'value' => '1']);
        EasyfyStoreSetting::create(['key' => 'cod_enabled', 'value' => '1']);
        EasyfyStoreSetting::create(['key' => 'instapay_enabled', 'value' => '1']);
        EasyfyStoreSetting::create(['key' => 'default_shipping_fee', 'value' => '50']);

        $this->product = EasyfyProduct::create([
            'name' => 'شنطة خاصة', 'slug' => 'custom-tote',
            'stock_mode' => EasyfyStockMode::MADE_TO_ORDER->value,
            'allow_artwork_upload' => true, 'is_active' => true,
        ]);
        $this->variant = EasyfyProductVariant::create([
            'product_id' => $this->product->id, 'sku' => 'TOTE-1', 'label' => 'كبير',
            'cost_price' => 42, 'selling_price' => 85, 'is_active' => true,
        ]);

        $this->tenantAAddress = EasyfyStoreAddress::create([
            'account_id' => $this->tenantAOwner->id,
            'label' => 'فرع أ',
            'recipient_name' => 'مالك متجر أ',
            'recipient_phone' => '01010000001',
            'governorate' => 'القاهرة',
            'address_line' => 'شارع عباس العقاد',
            'is_default' => true,
        ]);

        Sanctum::actingAs($this->tenantAOwner);
        $cartRes = $this->postJson('/api/easyfy/cart/items', ['variant_id' => $this->variant->id, 'quantity' => 5])->assertOk();
        $cartItemId = (int) $cartRes->json('data.items.0.id');
        $this->post("/api/easyfy/cart/items/{$cartItemId}/artwork", [
            'artwork' => UploadedFile::fake()->image('logo-a.png'),
        ])->assertOk();

        $orderRes = $this->post('/api/easyfy/orders', [
            'recipient_name' => 'مالك متجر أ',
            'recipient_phone' => '01010000001',
            'governorate' => 'القاهرة',
            'shipping_address' => 'شارع عباس العقاد',
            'payment_method' => EasyfyPaymentMethod::INSTAPAY->value,
            'transfer_reference' => 'IPA-A-777',
            'payment_proof' => UploadedFile::fake()->image('proof-a.png'),
        ])->assertStatus(201);

        $this->tenantAOrder = EasyfyOrder::with('items')->findOrFail($orderRes->json('data.id'));
    }

    public function test_cross_tenant_user_cannot_access_another_stores_orders_proofs_artworks_or_addresses(): void
    {
        Sanctum::actingAs($this->tenantBOwner);

        $this->getJson('/api/easyfy/orders')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("/api/easyfy/orders/{$this->tenantAOrder->id}")->assertStatus(404);
        $this->postJson("/api/easyfy/orders/{$this->tenantAOrder->id}/reorder")->assertStatus(404);
        $this->getJson("/api/easyfy/orders/{$this->tenantAOrder->id}/payment-proof")->assertStatus(404);

        $itemId = $this->tenantAOrder->items->first()->id;
        $this->getJson("/api/easyfy/orders/{$this->tenantAOrder->id}/items/{$itemId}/artwork")->assertStatus(404);

        $this->post("/api/easyfy/orders/{$this->tenantAOrder->id}/reupload-proof", [
            'transfer_reference' => 'HIJACK',
            'payment_proof' => UploadedFile::fake()->image('evil.png'),
        ])->assertStatus(404);

        $this->putJson("/api/easyfy/addresses/{$this->tenantAAddress->id}", [
            'label' => 'تعديل', 'recipient_name' => 'ب', 'recipient_phone' => '010',
            'governorate' => 'الجيزة', 'address_line' => 'الهرم',
        ])->assertStatus(404);

        $this->deleteJson("/api/easyfy/addresses/{$this->tenantAAddress->id}")->assertStatus(404);
    }

    public function test_same_store_mandob_can_view_order_and_stream_store_proof_and_artwork(): void
    {
        Sanctum::actingAs($this->tenantAMandob);

        $this->getJson("/api/easyfy/orders/{$this->tenantAOrder->id}")
            ->assertOk()
            ->assertJsonPath('data.id', $this->tenantAOrder->id);

        $this->get("/api/easyfy/orders/{$this->tenantAOrder->id}/payment-proof")->assertOk();

        $itemId = $this->tenantAOrder->items->first()->id;
        $this->get("/api/easyfy/orders/{$this->tenantAOrder->id}/items/{$itemId}/artwork")->assertOk();
    }

    public function test_non_admin_blocked_from_super_admin_easyfy_endpoints_and_costs_are_never_leaked_on_storefront(): void
    {
        Sanctum::actingAs($this->tenantAOwner);

        $this->getJson('/api/admin/overview')->assertStatus(403);
        $this->getJson('/api/admin/easyfy/orders')->assertStatus(403);
        $this->postJson('/api/admin/easyfy/products', ['name' => 'Hack'])->assertStatus(403);
        $this->assertDatabaseHas('admin_audit_logs', ['action' => AdminAuditAction::ADMIN_ACCESS_DENIED->value]);

        // Verify storefront catalog & order responses omit cost/profit fields completely
        $productJson = $this->getJson("/api/easyfy/products/{$this->product->slug}")->assertOk()->json('data');
        $this->assertArrayNotHasKey('cost_price', $productJson['variants'][0]);

        $orderJson = $this->getJson("/api/easyfy/orders/{$this->tenantAOrder->id}")->assertOk()->json('data');
        $this->assertArrayNotHasKey('total_cost', $orderJson);
        $this->assertArrayNotHasKey('gross_profit', $orderJson);
        $this->assertArrayNotHasKey('unit_cost', $orderJson['items'][0]);
        $this->assertArrayNotHasKey('line_cost', $orderJson['items'][0]);
        $this->assertArrayNotHasKey('line_profit', $orderJson['items'][0]);
    }
}
