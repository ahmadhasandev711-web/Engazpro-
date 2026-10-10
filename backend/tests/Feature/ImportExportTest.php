<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ImportExportTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create([
            'phone' => '01012345678',
        ]);

        // إنشاء اشتراك نشط
        Subscription::create([
            'user_id' => $this->user->id,
            'start_date' => now()->subDay(),
            'end_date' => now()->addYear(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);
    }

    public function test_can_get_products_template()
    {
        $response = $this->actingAs($this->user)
            ->getJson('/api/export/template/products');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => [
                    'headers',
                    'sample_rows',
                ],
            ]);
    }

    public function test_preview_products_identifies_valid_invalid_and_duplicate_rows()
    {
        // صنف موجود مسبقاً
        Product::create([
            'user_id' => $this->user->id,
            'name' => 'صنف مسجل مسبقا',
            'code' => 'EX-001',
            'barcode' => '1111222233334',
            'purchase_price' => 20,
            'sale_price' => 25,
            'quantity' => 10,
        ]);

        $payload = [
            'rows' => [
                // صف سليم تماماً
                [
                    'name' => 'صنف جديد سليم',
                    'category' => 'مشروبات',
                    'code' => 'NEW-101',
                    'barcode' => '999988887777',
                    'purchase_price' => 10,
                    'sale_price' => 15,
                    'quantity' => 50,
                ],
                // صف مكرر في قاعدة البيانات (بناءً على الكود والاسم)
                [
                    'name' => 'صنف مسجل مسبقا',
                    'code' => 'EX-001',
                    'purchase_price' => 22,
                    'sale_price' => 28,
                    'quantity' => 5,
                ],
                // صف غير صالح (سعر الشراء مفقود واسم الصنف فارغ)
                [
                    'name' => '',
                    'purchase_price' => 'غير رقمي',
                    'sale_price' => 10,
                ],
            ],
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/import/products/preview', $payload);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total_rows', 3)
            ->assertJsonPath('data.valid_count', 1)
            ->assertJsonPath('data.duplicate_count', 1)
            ->assertJsonPath('data.invalid_count', 1);

        $rows = $response->json('data.rows');
        $this->assertEquals('VALID', $rows[0]['status']);
        $this->assertEquals('DUPLICATE', $rows[1]['status']);
        $this->assertEquals('INVALID', $rows[2]['status']);
        $this->assertNotEmpty($rows[2]['errors']);
    }

    public function test_commit_products_creates_products_and_stock_movements_safely()
    {
        $payload = [
            'duplicate_action' => 'skip',
            'rows' => [
                [
                    'name' => 'عصير برتقال طبيعي',
                    'category_name' => 'عصائر طازجة',
                    'code' => 'JUICE-01',
                    'barcode' => '622000111222',
                    'purchase_price' => 12.50,
                    'sale_price' => 18.00,
                    'min_sale_price' => 16.00,
                    'quantity' => 40,
                    'min_quantity' => 5,
                    'notes' => 'يحفظ مبردا',
                ],
                [
                    'name' => 'مياه معدنية 500مل',
                    'category_name' => 'مياه',
                    'code' => 'WATER-01',
                    'purchase_price' => 3.00,
                    'sale_price' => 5.00,
                    'quantity' => 0, // بدون رصيد
                ],
            ],
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/import/products/commit', $payload);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.created_count', 2);

        // التحقق من إنشاء التصنيفات تلقائياً
        $this->assertDatabaseHas('categories', [
            'user_id' => $this->user->id,
            'name' => 'عصائر طازجة',
        ]);

        // التحقق من إنشاء المنتج الأول
        $product1 = Product::where('user_id', $this->user->id)
            ->where('code', 'JUICE-01')
            ->first();
        $this->assertNotNull($product1);
        $this->assertEquals(40, (float)$product1->quantity);

        // التحقق من تسجيل حركة المخزون الافتتاحية للمنتج الأول (دستور سلامة المخزون)
        $this->assertDatabaseHas('stock_movements', [
            'user_id' => $this->user->id,
            'product_id' => $product1->id,
            'type' => 'IN',
            'source_type' => 'INITIAL',
            'quantity' => 40,
            'balance_after' => 40,
        ]);

        // التحقق من أن المنتج ذو الرصيد 0 لم يتم إنشاء حركة مخزون له
        $product2 = Product::where('user_id', $this->user->id)
            ->where('code', 'WATER-01')
            ->first();
        $this->assertNotNull($product2);
        $this->assertEquals(0, (float)$product2->quantity);
        $this->assertDatabaseMissing('stock_movements', [
            'product_id' => $product2->id,
        ]);
    }

    public function test_commit_products_handles_update_duplicate_action()
    {
        $existingProduct = Product::create([
            'user_id' => $this->user->id,
            'name' => 'شاي أسود كلاسيك',
            'code' => 'TEA-01',
            'purchase_price' => 10,
            'sale_price' => 15,
            'quantity' => 20,
        ]);

        $payload = [
            'duplicate_action' => 'update',
            'rows' => [
                [
                    'name' => 'شاي أسود كلاسيك',
                    'code' => 'TEA-01',
                    'purchase_price' => 12, // سعر جديد
                    'sale_price' => 18,     // سعر جديد
                    'quantity' => 10,       // إضافة 10 وحدات
                ],
            ],
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/import/products/commit', $payload);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.updated_count', 1);

        $existingProduct->refresh();
        $this->assertEquals(12, (float)$existingProduct->purchase_price);
        $this->assertEquals(18, (float)$existingProduct->sale_price);
        $this->assertEquals(30, (float)$existingProduct->quantity); // 20 + 10

        // حركة المخزون تمت إضافتها للرصيد الجديد
        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $existingProduct->id,
            'type' => 'IN',
            'source_type' => 'INITIAL',
            'quantity' => 10,
            'balance_after' => 30,
        ]);
    }

    public function test_commit_products_handles_skip_duplicate_action()
    {
        $existingProduct = Product::create([
            'user_id' => $this->user->id,
            'name' => 'شاي أخضر',
            'code' => 'GRN-TEA',
            'purchase_price' => 15,
            'sale_price' => 20,
            'quantity' => 25,
        ]);

        $payload = [
            'duplicate_action' => 'skip',
            'rows' => [
                [
                    'name' => 'شاي أخضر',
                    'code' => 'GRN-TEA',
                    'purchase_price' => 100, // لن يتم تحديثه
                    'sale_price' => 200,
                    'quantity' => 50,
                ],
            ],
        ];

        $response = $this->actingAs($this->user)
            ->postJson('/api/import/products/commit', $payload);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.skipped_count', 1)
            ->assertJsonPath('data.updated_count', 0);

        $existingProduct->refresh();
        $this->assertEquals(15, (float)$existingProduct->purchase_price);
        $this->assertEquals(25, (float)$existingProduct->quantity);
    }
}
