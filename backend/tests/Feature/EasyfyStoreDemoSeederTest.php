<?php

namespace Tests\Feature;

use App\Enums\Easyfy\EasyfyStockMode;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Easyfy\EasyfyCategory;
use App\Models\Easyfy\EasyfyCoupon;
use App\Models\Easyfy\EasyfyProduct;
use App\Models\Easyfy\EasyfyShippingZone;
use App\Models\Easyfy\EasyfyStoreSetting;
use App\Models\User;
use Database\Seeders\EasyfyStoreDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class EasyfyStoreDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_seeder_populates_20_products_images_zones_coupons_and_is_idempotent(): void
    {
        Storage::fake('public');

        // Pre-seed custom admin setting to confirm seeder preserves existing config
        EasyfyStoreSetting::create(['key' => 'instapay_handle', 'value' => 'ahmad@instapay']);

        $this->seed(EasyfyStoreDemoSeeder::class);

        $this->assertSame(5, EasyfyCategory::count());
        $this->assertSame(20, EasyfyProduct::count());
        $this->assertSame(9, EasyfyProduct::where('stock_mode', EasyfyStockMode::TRACKED->value)->count());
        $this->assertSame(6, EasyfyProduct::where('stock_mode', EasyfyStockMode::UNLIMITED->value)->count());
        $this->assertSame(5, EasyfyProduct::where('stock_mode', EasyfyStockMode::MADE_TO_ORDER->value)->count());
        $this->assertSame(6, EasyfyShippingZone::count());
        $this->assertSame(3, EasyfyCoupon::count());

        Storage::disk('public')->assertExists('easyfy/catalog/demo-shipping-boxes.jpg');
        Storage::disk('public')->assertExists('easyfy/catalog/demo-custom-printed-bags.jpg');

        // Re-run seeder to confirm idempotency and preservation of existing settings
        $this->seed(EasyfyStoreDemoSeeder::class);

        $this->assertSame(5, EasyfyCategory::count());
        $this->assertSame(20, EasyfyProduct::count());
        $this->assertSame(
            'ahmad@instapay',
            EasyfyStoreSetting::where('key', 'instapay_handle')->value('value')
        );

        // Storefront API exposes all 20 products with absolute http image URLs
        $owner = User::factory()->create([
            'role' => UserRole::OWNER->value,
            'status' => UserStatus::ACTIVE->value,
        ]);
        Sanctum::actingAs($owner);

        $storefrontRes = $this->getJson('/api/easyfy/storefront')->assertOk();
        $this->assertCount(5, $storefrontRes->json('data.categories'));
        $this->assertCount(6, $storefrontRes->json('data.shipping_zones'));

        $productsRes = $this->getJson('/api/easyfy/products?per_page=25')->assertOk();
        $this->assertCount(20, $productsRes->json('data'));
        $firstImageUrl = (string) $productsRes->json('data.0.images.0.image_path');
        $this->assertStringStartsWith('http', $firstImageUrl);
    }
}
