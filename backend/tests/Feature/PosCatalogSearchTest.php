<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PosCatalogSearchTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'مالك الكاشير',
            'phone' => '01077770001',
            'password' => bcrypt('password'),
            'role' => UserRole::OWNER->value,
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->token = $this->owner->createToken('test')->plainTextToken;
        $this->seedCatalog();
    }

    public function test_pos_catalog_page_does_not_hide_products_beyond_the_old_250_cap(): void
    {
        $page = $this->authGet('/api/products/pos-catalog?per_page=500');

        $page->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('meta.per_page', 60)
            ->assertJsonPath('meta.total', 261);

        $this->assertCount(60, $page->json('data'));
        $names = collect($page->json('data'))->pluck('name');
        $this->assertFalse($names->contains('A-9999-NEEDLE'));

        $found = $this->authGet('/api/products/pos-catalog?search=NEEDLE&per_page=48');
        $found->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.name', 'A-9999-NEEDLE')
            ->assertJsonPath('data.0.code', 'NEEDLE-CODE');
        $this->assertLessThanOrEqual(48, count($found->json('data')));
    }

    public function test_lookup_finds_product_and_variant_outside_the_visible_page(): void
    {
        $byBarcode = $this->authGet('/api/products/lookup?code=6229999000260');
        $byBarcode->assertOk()
            ->assertJsonPath('data.name', 'A-9999-NEEDLE')
            ->assertJsonPath('matched_variant_id', null);

        $byCode = $this->authGet('/api/products/lookup?code=NEEDLE-CODE');
        $byCode->assertOk()->assertJsonPath('data.barcode', '6229999000260');

        $byVariant = $this->authGet('/api/products/lookup?code=VAR-RED-L');
        $byVariant->assertOk()
            ->assertJsonPath('data.name', 'قميص متغير')
            ->assertJsonPath('matched_variant_id', ProductVariant::where('barcode', 'VAR-RED-L')->value('id'));
    }

    public function test_lookup_does_not_leak_another_store_barcode(): void
    {
        $other = User::create([
            'name' => 'متجر آخر',
            'phone' => '01077770002',
            'password' => bcrypt('password'),
            'role' => UserRole::OWNER->value,
        ]);

        Product::create([
            'user_id' => $other->id,
            'name' => 'صنف متجر آخر',
            'code' => 'OTHER-CODE',
            'barcode' => 'OTHER-SECRET',
            'sale_price' => 10,
            'purchase_price' => 5,
            'quantity' => 1,
        ]);

        $this->authGet('/api/products/lookup?code=OTHER-SECRET')
            ->assertStatus(404)
            ->assertJsonPath('success', false);
    }

    private function seedCatalog(): void
    {
        $now = now();
        $rows = [];
        for ($i = 1; $i <= 259; $i++) {
            $rows[] = [
                'user_id' => $this->owner->id,
                'name' => sprintf('A-%04d', $i),
                'code' => sprintf('C%04d', $i),
                'barcode' => sprintf('2000000%04d', $i),
                'sale_price' => 10,
                'purchase_price' => 5,
                'quantity' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        $rows[] = [
            'user_id' => $this->owner->id,
            'name' => 'A-9999-NEEDLE',
            'code' => 'NEEDLE-CODE',
            'barcode' => '6229999000260',
            'sale_price' => 25,
            'purchase_price' => 10,
            'quantity' => 3,
            'created_at' => $now,
            'updated_at' => $now,
        ];
        Product::insert($rows);

        $variable = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'قميص متغير',
            'code' => 'SHIRT-1',
            'barcode' => 'SHIRT-PARENT',
            'has_variants' => true,
            'type' => 'VARIABLE',
            'sale_price' => 100,
            'purchase_price' => 50,
            'quantity' => 0,
        ]);

        ProductVariant::create([
            'product_id' => $variable->id,
            'user_id' => $this->owner->id,
            'name' => 'أحمر L',
            'barcode' => 'VAR-RED-L',
            'code' => 'VAR-CODE-1',
            'sale_price' => 110,
            'quantity' => 4,
        ]);
    }

    private function authGet(string $uri)
    {
        return $this->withHeader('Authorization', "Bearer {$this->token}")->getJson($uri);
    }
}
