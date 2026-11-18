<?php

namespace Tests\Feature;

use App\Enums\InvoiceType;
use App\Enums\PaymentMethod;
use App\Enums\ProductType;
use App\Enums\TreasuryType;
use App\Enums\UserRole;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\ProductBatch;
use App\Models\ProductVariant;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductVariantAndBatchTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $cashier;
    protected string $ownerToken;
    protected string $cashierToken;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Create Store Owner
        $this->owner = User::create([
            'name' => 'صاحب المتجر',
            'phone' => '01000000001',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER->value,
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ENTERPRISE',
        ]);

        Treasury::create([
            'user_id' => $this->owner->id,
            'name' => 'الخزينة الرئيسية',
            'balance' => 10000,
            'is_main' => true,
        ]);

        $this->ownerToken = $this->owner->createToken('owner_token')->plainTextToken;

        // 2. Create Cashier
        $this->cashier = User::create([
            'name' => 'كاشير الفرع',
            'phone' => '01000000002',
            'password' => bcrypt('password123'),
            'owner_id' => $this->owner->id,
            'role' => UserRole::CASHIER->value,
        ]);

        Treasury::create([
            'user_id' => $this->owner->id,
            'assigned_user_id' => $this->cashier->id,
            'name' => 'درج الكاشير',
            'balance' => 0,
            'is_main' => false,
        ]);

        $this->cashierToken = $this->cashier->createToken('cashier_token')->plainTextToken;
    }

    public function test_can_create_variable_product_with_variants_and_initial_stock(): void
    {
        $payload = [
            'name' => 'تيشيرت قطن بريميوم',
            'code' => 'TSH-01',
            'type' => 'VARIABLE',
            'purchase_price' => 100,
            'sale_price' => 200,
            'unit' => 'قطعة',
            'variants' => [
                [
                    'name' => 'أحمر - L',
                    'color' => 'أحمر',
                    'size' => 'L',
                    'barcode' => 'TSH-RED-L',
                    'purchase_price' => 90,
                    'sale_price' => 190,
                    'quantity' => 10,
                ],
                [
                    'name' => 'أزرق - XL',
                    'color' => 'أزرق',
                    'size' => 'XL',
                    'barcode' => 'TSH-BLU-XL',
                    'purchase_price' => 95,
                    'sale_price' => 210,
                    'quantity' => 15,
                ],
            ],
        ];

        $response = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/products', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.type', 'VARIABLE')
            ->assertJsonPath('data.has_variants', true);

        $productId = $response->json('data.id');
        $product = Product::find($productId);

        $this->assertCount(2, $product->variants);
        $this->assertEquals(25.0, (float) $product->quantity);

        $variant1 = $product->variants()->where('barcode', 'TSH-RED-L')->first();
        $this->assertNotNull($variant1);
        $this->assertEquals(10.0, (float) $variant1->quantity);

        $variant2 = $product->variants()->where('barcode', 'TSH-BLU-XL')->first();
        $this->assertNotNull($variant2);
        $this->assertEquals(15.0, (float) $variant2->quantity);
    }

    public function test_can_create_expiry_product_with_batches_and_add_batches_later(): void
    {
        $payload = [
            'name' => 'حليب كامل الدسم 1 لتر',
            'code' => 'MILK-01',
            'type' => 'EXPIRY',
            'purchase_price' => 25,
            'sale_price' => 35,
            'unit' => 'علبة',
            'batches' => [
                [
                    'batch_number' => 'LOT-2026-01',
                    'expiry_date' => now()->addMonths(2)->format('Y-m-d'),
                    'production_date' => now()->subDays(5)->format('Y-m-d'),
                    'quantity' => 30,
                    'purchase_price' => 24,
                    'sale_price' => 35,
                ],
            ],
        ];

        $response = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/products', $payload);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.type', 'EXPIRY')
            ->assertJsonPath('data.has_expiry', true);

        $productId = $response->json('data.id');
        $product = Product::find($productId);

        $this->assertCount(1, $product->batches);
        $this->assertEquals(30.0, (float) $product->quantity);

        // Add a new batch via endpoint
        $batchPayload = [
            'batch_number' => 'LOT-2026-02',
            'expiry_date' => now()->addMonths(6)->format('Y-m-d'),
            'quantity' => 20,
            'purchase_price' => 26,
            'sale_price' => 37,
        ];

        $addBatchResponse = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson("/api/products/{$productId}/batches", $batchPayload);

        $addBatchResponse->assertStatus(201)
            ->assertJsonPath('success', true);

        $product->refresh();
        $this->assertCount(2, $product->batches);
        $this->assertEquals(50.0, (float) $product->quantity);
    }

    public function test_selling_variant_deducts_variant_and_product_stock(): void
    {
        // Setup product with variant
        $payload = [
            'name' => 'حذاء رياضي',
            'code' => 'SHOES-01',
            'type' => 'VARIABLE',
            'purchase_price' => 300,
            'sale_price' => 500,
            'variants' => [
                [
                    'name' => 'مقاس 42',
                    'size' => '42',
                    'barcode' => 'SHOE-42',
                    'purchase_price' => 290,
                    'sale_price' => 490,
                    'quantity' => 5,
                ],
            ],
        ];

        $createResponse = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/products', $payload);

        $productId = $createResponse->json('data.id');
        $variantId = $createResponse->json('data.variants.0.id');

        // Sell 2 units of variant 42
        $invoiceResponse = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/invoices', [
                'type' => 'SALE',
                'date' => now()->toDateString(),
                'items' => [
                    [
                        'product_id' => $productId,
                        'product_variant_id' => $variantId,
                        'quantity' => 2,
                        'unit_price' => 490,
                    ],
                ],
            ]);

        $invoiceResponse->assertStatus(201);

        $variant = ProductVariant::find($variantId);
        $product = Product::find($productId);

        $this->assertEquals(3.0, (float) $variant->quantity);
        $this->assertEquals(3.0, (float) $product->quantity);
    }

    public function test_selling_expiry_product_applies_fefo_deduction_automatically(): void
    {
        // Product with 2 batches: one expiring soon (earliest), one expiring later
        $earlierDate = now()->addMonths(1)->format('Y-m-d');
        $laterDate = now()->addMonths(5)->format('Y-m-d');

        $payload = [
            'name' => 'زبادي طبيعي',
            'code' => 'YOGURT-01',
            'type' => 'EXPIRY',
            'purchase_price' => 5,
            'sale_price' => 8,
            'batches' => [
                [
                    'batch_number' => 'BATCH-LATER',
                    'expiry_date' => $laterDate,
                    'quantity' => 20,
                    'purchase_price' => 5,
                ],
                [
                    'batch_number' => 'BATCH-EARLIER',
                    'expiry_date' => $earlierDate,
                    'quantity' => 10,
                    'purchase_price' => 5,
                ],
            ],
        ];

        $createRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/products', $payload);

        $productId = $createRes->json('data.id');

        // Sell without specifying batch_id -> FEFO should pick BATCH-EARLIER
        $invRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/invoices', [
                'type' => 'SALE',
                'date' => now()->toDateString(),
                'items' => [
                    [
                        'product_id' => $productId,
                        'quantity' => 4,
                        'unit_price' => 8,
                    ],
                ],
            ]);

        $invRes->assertStatus(201);

        $earlierBatch = ProductBatch::where('product_id', $productId)->where('batch_number', 'BATCH-EARLIER')->first();
        $laterBatch = ProductBatch::where('product_id', $productId)->where('batch_number', 'BATCH-LATER')->first();

        // 10 - 4 = 6
        $this->assertEquals(6.0, (float) $earlierBatch->quantity);
        // Later batch remained 20
        $this->assertEquals(20.0, (float) $laterBatch->quantity);
    }

    public function test_sub_unit_sales_convert_stock_quantity_correctly(): void
    {
        $payload = [
            'name' => 'شيبسي عائلي',
            'code' => 'CHIPS-01',
            'purchase_price' => 10,
            'sale_price' => 15,
            'quantity' => 100, // 100 pieces
            'unit' => 'قطعة',
            'sub_unit' => 'كرتونة',
            'sub_unit_factor' => 24, // 1 carton = 24 pieces
            'sub_unit_price' => 300,
        ];

        $createRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/products', $payload);

        $productId = $createRes->json('data.id');

        // Sell 2 cartons (2 * 24 = 48 pieces should be deducted)
        $invRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/invoices', [
                'type' => 'SALE',
                'date' => now()->toDateString(),
                'items' => [
                    [
                        'product_id' => $productId,
                        'quantity' => 2,
                        'unit_name' => 'كرتونة',
                        'unit_price' => 300,
                    ],
                ],
            ]);

        $invRes->assertStatus(201);

        $product = Product::find($productId);
        // 100 - (2 * 24) = 100 - 48 = 52
        $this->assertEquals(52.0, (float) $product->quantity);
    }

    public function test_strict_cost_price_privacy_for_cashier_on_variants_and_batches(): void
    {
        $payload = [
            'name' => 'قميص رجالي فاخر',
            'code' => 'SHIRT-01',
            'type' => 'VARIABLE',
            'purchase_price' => 150,
            'sale_price' => 250,
            'variants' => [
                [
                    'name' => 'أبيض - XL',
                    'barcode' => 'SHIRT-WH-XL',
                    'purchase_price' => 140,
                    'sale_price' => 240,
                    'quantity' => 10,
                ],
            ],
        ];

        $createRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->postJson('/api/products', $payload);

        $productId = $createRes->json('data.id');

        // 1. As OWNER: purchase_price MUST be visible
        $ownerRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")
            ->getJson("/api/products/{$productId}");

        $ownerRes->assertStatus(200)
            ->assertJsonPath('data.purchase_price', 150)
            ->assertJsonPath('data.variants.0.purchase_price', 140);

        // 2. As CASHIER: purchase_price MUST be null (ZERO LEAK)
        $cashierRes = $this->actingAs($this->cashier, 'sanctum')
            ->getJson("/api/products/{$productId}");

        $cashierRes->assertStatus(200)
            ->assertJsonPath('data.purchase_price', null)
            ->assertJsonPath('data.variants.0.purchase_price', null);
    }

    public function test_variable_product_invoice_exposure_returns_purchases_and_branch_reversal(): void
    {
        $branch = Branch::create(['user_id' => $this->owner->id, 'name' => 'فرع الملابس', 'code' => 'BR-CLO', 'is_main' => true, 'is_active' => true]);
        $createRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")->postJson('/api/products', [
            'name' => 'تيشيرت كاجوال قطن', 'type' => ProductType::VARIABLE->value,
            'purchase_price' => 100, 'sale_price' => 220, 'branch_id' => $branch->id,
            'variants' => [
                ['name' => 'أبيض / L', 'color' => 'أبيض', 'size' => 'L', 'quantity' => 5, 'purchase_price' => 100, 'sale_price' => 220],
                ['name' => 'أسود / M', 'color' => 'أسود', 'size' => 'M', 'quantity' => 8, 'purchase_price' => 100, 'sale_price' => 220],
            ],
        ]);
        $createRes->assertStatus(201);
        $product = Product::findOrFail($createRes->json('data.id'));
        $varL = $product->variants()->where('name', 'أبيض / L')->firstOrFail();
        $varM = $product->variants()->where('name', 'أسود / M')->firstOrFail();

        BranchStock::updateOrCreate(['branch_id' => $branch->id, 'product_id' => $product->id, 'product_variant_id' => $varL->id], ['quantity' => 5]);
        BranchStock::updateOrCreate(['branch_id' => $branch->id, 'product_id' => $product->id, 'product_variant_id' => $varM->id], ['quantity' => 8]);

        // 1. Sell both variants on a single cash invoice
        $saleRes = $this->withHeader('Authorization', "Bearer {$this->ownerToken}")->postJson('/api/invoices', [
            'type' => InvoiceType::SALE->value, 'branch_id' => $branch->id,
            'date' => now()->toDateString(), 'payment_method' => PaymentMethod::CASH->value, 'paid_amount' => 660,
            'items' => [
                ['product_id' => $product->id, 'product_variant_id' => $varL->id, 'variant_name' => $varL->name, 'quantity' => 2, 'unit_price' => 220],
                ['product_id' => $product->id, 'product_variant_id' => $varM->id, 'variant_name' => $varM->name, 'quantity' => 1, 'unit_price' => 220],
            ],
        ]);
        $saleRes->assertStatus(201);
        $invId = $saleRes->json('data.id');
        $invNumber = $saleRes->json('data.invoice_number');

        // Resource & by-number lookup expose product_variant_id and variant_name
        $this->withHeader('Authorization', "Bearer {$this->ownerToken}")->getJson("/api/invoices/by-number/{$invNumber}")
            ->assertStatus(200)
            ->assertJsonPath('data.items.0.product_variant_id', $varL->id)
            ->assertJsonPath('data.items.0.variant_name', 'أبيض / L')
            ->assertJsonPath('data.items.1.product_variant_id', $varM->id)
            ->assertJsonPath('data.items.1.variant_name', 'أسود / M');

        $this->assertEquals(3, (float) $varL->fresh()->quantity);
        $this->assertEquals(7, (float) $varM->fresh()->quantity);

        // 2. Sale return on specific variant restores that variant + branch stock cleanly
        $this->withHeader('Authorization', "Bearer {$this->ownerToken}")->postJson('/api/invoices', [
            'type' => InvoiceType::SALE_RETURN->value, 'branch_id' => $branch->id, 'parent_invoice_id' => $invId,
            'date' => now()->toDateString(), 'payment_method' => PaymentMethod::CASH->value, 'paid_amount' => 220,
            'items' => [['product_id' => $product->id, 'product_variant_id' => $varL->id, 'variant_name' => $varL->name, 'quantity' => 1, 'unit_price' => 220]],
        ])->assertStatus(201);
        $this->assertEquals(4, (float) $varL->fresh()->quantity);
        $this->assertEquals(4, (float) BranchStock::where('branch_id', $branch->id)->where('product_variant_id', $varL->id)->value('quantity'));

        // 3. Purchase increments specific variant & branch stock
        $this->withHeader('Authorization', "Bearer {$this->ownerToken}")->postJson('/api/invoices', [
            'type' => InvoiceType::PURCHASE->value, 'branch_id' => $branch->id,
            'date' => now()->toDateString(), 'payment_method' => PaymentMethod::CASH->value, 'paid_amount' => 440,
            'items' => [['product_id' => $product->id, 'product_variant_id' => $varM->id, 'variant_name' => $varM->name, 'quantity' => 4, 'unit_price' => 110]],
        ])->assertStatus(201);
        $this->assertEquals(11, (float) $varM->fresh()->quantity);
        $this->assertEquals(11, (float) BranchStock::where('branch_id', $branch->id)->where('product_variant_id', $varM->id)->value('quantity'));

        // 4. Delete cash sale invoice reverses variant + branch stock + main treasury balance
        $invTreasury = Treasury::findOrFail(Invoice::findOrFail($invId)->treasury_id);
        $balanceBeforeDelete = (float) $invTreasury->balance;
        $this->withHeader('Authorization', "Bearer {$this->ownerToken}")->deleteJson("/api/invoices/{$invId}")->assertStatus(200);
        $this->assertEquals(6, (float) $varL->fresh()->quantity);
        $this->assertEquals(12, (float) $varM->fresh()->quantity);
        $this->assertEquals(6, (float) BranchStock::where('branch_id', $branch->id)->where('product_variant_id', $varL->id)->value('quantity'));
        $this->assertEquals($balanceBeforeDelete - 660, (float) $invTreasury->fresh()->balance);
    }
}
