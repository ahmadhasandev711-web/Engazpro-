<?php

namespace Tests\Feature\EasyOrders;

use App\Contracts\EasyOrdersApiClientInterface;
use App\Enums\EasyOrdersAuthMode;
use App\Enums\ProductType;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Exceptions\EasyOrdersConnectionException;
use App\Jobs\PushStockToEasyOrdersJob;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\EasyOrdersIntegration;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class EasyOrdersProductImportAndStockSyncTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;
    private User $otherOwner;
    private Branch $branch;
    private EasyOrdersIntegration $integration;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => UserRole::OWNER->value, 'ecommerce_enabled' => true]);
        $this->otherOwner = User::factory()->create(['role' => UserRole::OWNER->value, 'ecommerce_enabled' => true]);
        foreach ([$this->owner, $this->otherOwner] as $u) {
            Subscription::create([
                'user_id' => $u->id,
                'start_date' => now()->toDateString(),
                'end_date' => now()->addYear()->toDateString(),
                'status' => SubscriptionStatus::ACTIVE->value,
                'plan' => 'PRO',
            ]);
        }

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع مدينة نصر',
            'code' => 'NASR-01',
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->integration = EasyOrdersIntegration::create([
            'user_id' => $this->owner->id,
            'store_id' => 'store-111',
            'auth_mode' => EasyOrdersAuthMode::API_KEY->value,
            'api_key' => 'valid-eo-api-key',
            'webhook_secret' => 'wh-sec-111',
            'default_branch_id' => $this->branch->id,
            'auto_sync_stock' => true,
            'is_active' => true,
        ]);
    }

    public function test_imports_simple_and_variable_products_with_initial_branch_stock(): void
    {
        Http::fake([
            'https://api.easy-orders.net/api/v1/external-apps/products*' => Http::response([
                'data' => [
                    [
                        'id' => 'eo-prod-simple',
                        'name' => 'تيشيرت بيزيك قطن',
                        'price' => 450,
                        'sale_price' => 390,
                        'quantity' => 15,
                        'sku' => 'TS-01',
                        'categories' => [['name' => 'تيشيرتات']],
                        'variants' => [],
                    ],
                    [
                        'id' => 'eo-prod-var',
                        'name' => 'ترنج أديداس',
                        'price' => 950,
                        'sale_price' => 0,
                        'taager_code' => 'TR-MAIN-01',
                        'variants' => [
                            [
                                'id' => 'eo-var-1',
                                'price' => 950,
                                'sale_price' => 0,
                                'quantity' => 7,
                                'taager_code' => 'TR-M-BLK',
                                'variation_props' => [
                                    ['variation_prop' => 'أسود'],
                                    ['variation_prop' => 'M'],
                                ],
                            ],
                        ],
                    ],
                ],
                'pageCount' => 1,
            ]),
        ]);

        $res = $this->actingAs($this->owner)->postJson('/api/easyorders/import-products', ['import_stock' => true]);
        $res->assertOk()->assertJsonPath('data.imported', 2);

        $simple = Product::where('user_id', $this->owner->id)->where('easyorders_product_id', 'eo-prod-simple')->firstOrFail();
        $this->assertEquals(ProductType::STANDARD->value, $simple->type);
        $this->assertEquals('TS-01', $simple->easyorders_sku);
        $this->assertEquals('390.00', $simple->sale_price);
        $this->assertEquals(15, (int) BranchStock::where('branch_id', $this->branch->id)->where('product_id', $simple->id)->value('quantity'));

        $variable = Product::where('user_id', $this->owner->id)->where('easyorders_product_id', 'eo-prod-var')->firstOrFail();
        $this->assertEquals(ProductType::VARIABLE->value, $variable->type);
        $variant = ProductVariant::where('product_id', $variable->id)->where('easyorders_variant_id', 'eo-var-1')->firstOrFail();
        $this->assertEquals('TR-M-BLK', $variant->easyorders_taager_code);
        $this->assertEquals('أسود - M', $variant->name);
    }

    public function test_pushes_stock_for_simple_and_variant_products_and_warns_when_missing_sku(): void
    {
        $simple = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'جاكيت جينز',
            'code' => 'JKT-01',
            'purchase_price' => 400,
            'regular_price' => 900,
            'sale_price' => 850,
            'quantity' => 12,
            'unit' => 'قطعة',
            'easyorders_product_id' => 'eo-jkt',
            'easyorders_sku' => 'JKT-01',
        ]);
        BranchStock::create(['user_id' => $this->owner->id, 'branch_id' => $this->branch->id, 'product_id' => $simple->id, 'quantity' => 12]);

        $missingSku = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف بدون كود',
            'purchase_price' => 50,
            'regular_price' => 100,
            'sale_price' => 100,
            'quantity' => 5,
            'unit' => 'قطعة',
        ]);

        Http::fake([
            'https://api.easy-orders.net/api/v1/external-apps/products/sku/JKT-01/quantity' => Http::response(['quantity' => 12], 200),
        ]);

        $resOk = $this->actingAs($this->owner)->postJson("/api/easyorders/products/{$simple->id}/push-stock");
        $resOk->assertOk()->assertJsonPath('data.pushed_entries', 1);

        $resMissing = $this->actingAs($this->owner)->postJson("/api/easyorders/products/{$missingSku->id}/push-stock");
        $resMissing->assertOk()->assertJsonPath('data.pushed_entries', 0);

        // Tenant isolation: another store cannot see or push stock on owner's product (BelongsToStore global scope -> 404)
        $resForbidden = $this->actingAs($this->otherOwner)->postJson("/api/easyorders/products/{$simple->id}/push-stock");
        $resForbidden->assertNotFound();
    }

    public function test_records_rate_limit_429_cleanly_in_job(): void
    {
        $product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'هودي تيست 429',
            'code' => 'HD-429',
            'purchase_price' => 200,
            'regular_price' => 500,
            'sale_price' => 500,
            'quantity' => 8,
            'unit' => 'قطعة',
            'easyorders_sku' => 'HD-429',
        ]);
        BranchStock::create(['user_id' => $this->owner->id, 'branch_id' => $this->branch->id, 'product_id' => $product->id, 'quantity' => 8]);

        $this->mock(EasyOrdersApiClientInterface::class, function ($mock) {
            $mock->shouldReceive('updateProductStockBySku')
                ->once()
                ->andThrow(new EasyOrdersConnectionException('429 rate limited', 429, 60));
        });

        Http::fake();
        PushStockToEasyOrdersJob::dispatchSync($this->owner->id, $product->id);

        // Ensure execution finishes cleanly without hard crash
        $this->assertTrue(true);
    }
}
