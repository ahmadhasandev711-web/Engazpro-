<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Product;
use App\Models\ProductVariant;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\User;
use App\Services\BarcodeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductVariantAndBarcodeTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $otherOwner;
    protected string $ownerToken;
    protected string $otherOwnerToken;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. First Store Owner (Tenant 1)
        $this->owner = User::create([
            'name' => 'تاجر الملابس والأحذية',
            'phone' => '01011111111',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER->value,
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        Treasury::create([
            'user_id' => $this->owner->id,
            'name' => 'الخزينة الرئيسية 1',
            'balance' => 5000,
            'is_main' => true,
        ]);

        $this->ownerToken = $this->owner->createToken('owner_token')->plainTextToken;

        // 2. Second Store Owner (Tenant 2 - Multi-tenancy isolation)
        $this->otherOwner = User::create([
            'name' => 'متجر ملابس آخر',
            'phone' => '01022222222',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER->value,
        ]);

        Subscription::create([
            'user_id' => $this->otherOwner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        Treasury::create([
            'user_id' => $this->otherOwner->id,
            'name' => 'الخزينة الرئيسية 2',
            'balance' => 5000,
            'is_main' => true,
        ]);

        $this->otherOwnerToken = $this->otherOwner->createToken('other_token')->plainTextToken;
    }

    public function test_can_generate_unique_barcodes_via_service_and_api(): void
    {
        $service = app(BarcodeService::class);
        $barcodes = $service->generateUniqueBarcodes($this->owner, 5);

        $this->assertCount(5, $barcodes);
        $this->assertCount(5, array_unique($barcodes));

        $res = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->getJson('/api/barcodes/generate?count=3');

        $res->assertStatus(200)
            ->assertJsonPath('success', true);

        $data = $res->json('data');
        $this->assertNotEmpty($data['barcode']);
        $this->assertCount(3, $data['barcodes']);
        $this->assertCount(3, array_unique($data['barcodes']));
    }

    public function test_can_validate_barcode_availability_via_api(): void
    {
        // 1. Create a product with specific barcode
        Product::create([
            'user_id' => $this->owner->id,
            'name' => 'قميص رجالي أبيض',
            'barcode' => '6221234567890',
            'sale_price' => 250,
            'purchase_price' => 150,
            'quantity' => 5,
        ]);

        // 2. Validate taken barcode
        $resTaken = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/barcodes/validate', [
                'barcode' => '6221234567890',
            ]);

        $resTaken->assertStatus(200)
            ->assertJsonPath('data.is_available', false);

        // 3. Validate free barcode
        $resFree = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/barcodes/validate', [
                'barcode' => '9999999999999',
            ]);

        $resFree->assertStatus(200)
            ->assertJsonPath('data.is_available', true);
    }

    public function test_can_create_variant_matrix_with_barcodes_and_verify_stock(): void
    {
        $payload = [
            'name' => 'حذاء رياضي كاجوال',
            'code' => 'SHOE-01',
            'type' => 'VARIABLE',
            'purchase_price' => 300,
            'sale_price' => 500,
            'unit' => 'زوج',
            'variants' => [
                [
                    'name' => 'أسود / 41',
                    'color' => 'أسود',
                    'size' => '41',
                    'barcode' => '200000000001',
                    'purchase_price' => 300,
                    'sale_price' => 500,
                    'quantity' => 6,
                    'min_quantity' => 2,
                ],
                [
                    'name' => 'أسود / 42',
                    'color' => 'أسود',
                    'size' => '42',
                    'barcode' => '200000000002',
                    'purchase_price' => 300,
                    'sale_price' => 500,
                    'quantity' => 8,
                    'min_quantity' => 2,
                ],
                [
                    'name' => 'أبيض / 41',
                    'color' => 'أبيض',
                    'size' => '41',
                    'barcode' => '200000000003',
                    'purchase_price' => 310,
                    'sale_price' => 520,
                    'quantity' => 4,
                    'min_quantity' => 1,
                ],
                [
                    'name' => 'أبيض / 42',
                    'color' => 'أبيض',
                    'size' => '42',
                    'barcode' => '200000000004',
                    'purchase_price' => 310,
                    'sale_price' => 520,
                    'quantity' => 5,
                    'min_quantity' => 1,
                ],
            ],
        ];

        $res = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/products', $payload);

        $res->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'حذاء رياضي كاجوال')
            ->assertJsonPath('data.has_variants', true);

        $productId = $res->json('data.id');
        $product = Product::with('variants')->findOrFail($productId);

        $this->assertEquals(23, (float) $product->quantity); // 6 + 8 + 4 + 5 = 23
        $this->assertCount(4, $product->variants);

        // Check movements
        $movementsCount = $product->stockMovements()->where('source_type', 'INITIAL')->count();
        $this->assertEquals(4, $movementsCount);
    }

    public function test_prevents_duplicate_barcode_within_same_store(): void
    {
        // 1. Create first product with barcode
        $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/products', [
                'name' => 'بنطلون جينز أزرق',
                'barcode' => 'PANT-12345',
                'purchase_price' => 120,
                'sale_price' => 220,
                'quantity' => 5,
            ])
            ->assertStatus(201);

        // 2. Try creating a variant with the exact same barcode
        $duplicatePayload = [
            'name' => 'تيشيرت بولو',
            'type' => 'VARIABLE',
            'purchase_price' => 80,
            'sale_price' => 160,
            'variants' => [
                [
                    'name' => 'أحمر / M',
                    'color' => 'أحمر',
                    'size' => 'M',
                    'barcode' => 'PANT-12345', // Duplicate!
                    'sale_price' => 160,
                    'quantity' => 3,
                ],
            ],
        ];

        $res = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/products', $duplicatePayload);

        $res->assertStatus(422)
            ->assertJsonPath('error_code', 'DUPLICATE_BARCODE');
    }

    public function test_prevents_duplicate_barcode_within_variant_matrix_payload(): void
    {
        $payload = [
            'name' => 'سويت شيرت شتوي',
            'type' => 'VARIABLE',
            'purchase_price' => 150,
            'sale_price' => 300,
            'variants' => [
                [
                    'name' => 'رمادي / L',
                    'color' => 'رمادي',
                    'size' => 'L',
                    'barcode' => 'SWT-SAME-01',
                    'sale_price' => 300,
                    'quantity' => 2,
                ],
                [
                    'name' => 'رمادي / XL',
                    'color' => 'رمادي',
                    'size' => 'XL',
                    'barcode' => 'SWT-SAME-01', // Duplicate within matrix!
                    'sale_price' => 300,
                    'quantity' => 4,
                ],
            ],
        ];

        $res = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/products', $payload);

        $res->assertStatus(422)
            ->assertJsonPath('error_code', 'DUPLICATE_BARCODE');
    }

    public function test_allows_same_barcode_for_different_stores_multi_tenancy(): void
    {
        $sharedBarcode = 'BARCODE-TENANT-SHARED-99';

        // Store 1 creates product with this barcode
        $this->actingAs($this->owner)
            ->postJson('/api/products', [
                'name' => 'صنف متجر 1',
                'barcode' => $sharedBarcode,
                'purchase_price' => 100,
                'sale_price' => 150,
                'quantity' => 10,
            ])
            ->assertStatus(201);

        // Store 2 creates product with the exact same barcode -> MUST SUCCEED (Multi-tenancy)
        $this->actingAs($this->otherOwner)
            ->postJson('/api/products', [
                'name' => 'صنف متجر 2',
                'type' => 'VARIABLE',
                'purchase_price' => 100,
                'sale_price' => 150,
                'variants' => [
                    [
                        'name' => 'مقاس خاص',
                        'barcode' => $sharedBarcode,
                        'sale_price' => 150,
                        'quantity' => 5,
                    ],
                ],
            ])
            ->assertStatus(201);
    }

    public function test_selling_variant_by_barcode_deducts_variant_and_overall_product_stock(): void
    {
        // 1. Create product with variants
        $prodRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/products', [
                'name' => 'جاكيت جلد طبيعي',
                'type' => 'VARIABLE',
                'purchase_price' => 400,
                'sale_price' => 700,
                'variants' => [
                    [
                        'name' => 'بني / XL',
                        'color' => 'بني',
                        'size' => 'XL',
                        'barcode' => 'JKT-BRN-XL',
                        'purchase_price' => 400,
                        'sale_price' => 700,
                        'quantity' => 5,
                    ],
                ],
            ]);

        $prodId = $prodRes->json('data.id');
        $variantId = $prodRes->json('data.variants.0.id');

        // 2. Issue a sale invoice for 2 pieces of this variant
        $invoicePayload = [
            'type' => 'SALE',
            'date' => now()->toDateString(),
            'payment_method' => 'CASH',
            'items' => [
                [
                    'product_id' => $prodId,
                    'product_variant_id' => $variantId,
                    'quantity' => 2,
                    'unit_price' => 700,
                ],
            ],
        ];

        $invRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/invoices', $invoicePayload);

        $invRes->assertStatus(201);

        // 3. Verify stock deduction
        $product = Product::with('variants')->findOrFail($prodId);
        $variant = $product->variants->firstWhere('id', $variantId);

        $this->assertEquals(3, (float) $variant->quantity); // 5 - 2 = 3
        $this->assertEquals(3, (float) $product->quantity); // 5 - 2 = 3
    }

    public function test_can_update_product_variants_safely(): void
    {
        // 1. Create product
        $prodRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/products', [
                'name' => 'شورت جينز صيفي',
                'type' => 'VARIABLE',
                'purchase_price' => 80,
                'sale_price' => 150,
                'variants' => [
                    [
                        'name' => 'كحلي / 32',
                        'color' => 'كحلي',
                        'size' => '32',
                        'barcode' => 'SHRT-32',
                        'sale_price' => 150,
                        'quantity' => 5,
                    ],
                ],
            ]);

        $prodId = $prodRes->json('data.id');
        $varId = $prodRes->json('data.variants.0.id');

        // 2. Update variant and add another variant
        $updatePayload = [
            'name' => 'شورت جينز صيفي معدل',
            'purchase_price' => 80,
            'sale_price' => 160,
            'variants' => [
                [
                    'id' => $varId,
                    'name' => 'كحلي / 32 فاخر',
                    'color' => 'كحلي',
                    'size' => '32',
                    'barcode' => 'SHRT-32-NEW',
                    'sale_price' => 160,
                ],
                [
                    'name' => 'كحلي / 34',
                    'color' => 'كحلي',
                    'size' => '34',
                    'barcode' => 'SHRT-34',
                    'sale_price' => 160,
                    'quantity' => 7,
                ],
            ],
        ];

        $updateRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->putJson("/api/products/{$prodId}", $updatePayload);

        $updateRes->assertStatus(200)
            ->assertJsonPath('data.name', 'شورت جينز صيفي معدل');

        $product = Product::with('variants')->findOrFail($prodId);
        $this->assertCount(2, $product->variants);
        $this->assertEquals(12, (float) $product->quantity); // 5 + 7 = 12
    }
}
