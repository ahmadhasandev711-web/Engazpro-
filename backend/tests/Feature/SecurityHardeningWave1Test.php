<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Models\Branch;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityHardeningWave1Test extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $mainBranch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'صاحب المتجر',
            'phone' => '01000000001',
            'password' => bcrypt('password123'),
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->mainBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'MAIN-01',
            'type' => BranchType::STORE,
            'is_main' => true,
            'is_active' => true,
        ]);
    }

    /**
     * Item 1: ProductRequest rejects XSS payloads and special characters in barcode
     */
    public function test_product_request_rejects_xss_payload_in_barcode(): void
    {
        $response = $this->actingAs($this->owner)->postJson('/api/products', [
            'name' => 'منتج اختبار أمان',
            'purchase_price' => 50,
            'sale_price' => 100,
            'barcode' => '"><img src=x onerror=alert(1)>',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['barcode']);
    }

    /**
     * Item 1: ImportService rejects XSS payloads and special characters in barcode
     */
    public function test_import_service_rejects_xss_payload_in_barcode(): void
    {
        $importService = app(\App\Services\ImportService::class);
        $result = $importService->previewProducts($this->owner, [
            [
                'name' => 'صنف مستورد',
                'barcode' => '"><img src=x onerror=alert(1)>',
                'purchase_price' => 50,
                'sale_price' => 100,
            ]
        ]);

        $this->assertEquals(0, $result['valid_count']);
        $this->assertEquals(1, $result['invalid_count']);
        $this->assertStringContainsString('رموز غير مسموحة', $result['rows'][0]['errors'][0]);
    }

    /**
     * Item 2: WooCommerceSettingsController::saveSettings does not leak consumer_secret or full consumer_key
     */
    public function test_save_settings_does_not_leak_consumer_secrets_or_full_keys(): void
    {
        $mockClient = \Mockery::mock(\App\Services\WooCommerce\WooCommerceApiClient::class);
        $mockClient->shouldReceive('registerWebhooks')->andReturnTrue();
        $this->app->instance(\App\Services\WooCommerce\WooCommerceApiClient::class, $mockClient);

        $response = $this->actingAs($this->owner)->postJson('/api/woocommerce/settings', [
            'store_url' => 'https://example-shop.com',
            'consumer_key' => 'ck_super_secret_key_1234567890',
            'consumer_secret' => 'cs_ultra_private_secret_9876543210',
            'is_active' => true,
        ]);

        $response->assertStatus(200);
        $data = $response->json('data');

        $this->assertArrayNotHasKey('consumer_secret', $data);
        $this->assertArrayNotHasKey('consumer_key', $data);
        $this->assertStringNotContainsString('cs_ultra_private_secret_9876543210', json_encode($data));
        $this->assertStringNotContainsString('ck_super_secret_key_1234567890', json_encode($data));
        $this->assertEquals('ck_supe...7890', $data['consumer_key_preview']);
        $this->assertNotEmpty($data['webhook_secret']);
    }
}
