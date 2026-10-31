<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StockReportPaginationTest extends TestCase
{
    use RefreshDatabase;

    public function test_stock_report_is_paginated_and_summaries_are_calculated_over_all_products(): void
    {
        $owner = User::create([
            'name' => 'مالك تجربة المخزون',
            'phone' => '01011113333',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER,
            'status' => UserStatus::ACTIVE,
        ]);

        Subscription::create([
            'user_id' => $owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ANNUAL',
        ]);

        $token = $owner->createToken('test')->plainTextToken;

        // إنشاء 120 صنف للمتجر
        $productsData = [];
        for ($i = 1; $i <= 120; $i++) {
            $productsData[] = [
                'user_id' => $owner->id,
                'name' => "منتج تجريبي رقم {$i}",
                'code' => sprintf('PRD-%04d', $i),
                'barcode' => sprintf('BAR%06d', $i),
                'quantity' => 10,
                'purchase_price' => 100,
                'sale_price' => 150,
                'min_quantity' => ($i <= 10) ? 15 : 5, // أول 10 أصناف نواقص (كمية 10 <= حد 15)
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }
        Product::insert($productsData);

        // طلب الصفحة الأولى (الافتراضي 50 صنف)
        $res = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/stock?page=1');

        $res->assertStatus(200);

        $data = $res->json('data');

        // التحقق من أن القائمة صفحة من 50 صنفاً فقط وليس الـ 120 كلهم في الذاكرة
        $this->assertCount(50, $data['products'], 'الصفحة الأولى يجب أن تحتوي على 50 صنف فقط');

        // التحقق من أن الإجماليات محسوبة على كامل الـ 120 صنفاً عبر SQL
        $this->assertSame(120, $data['summary']['products_count']);
        $this->assertEquals(1200, $data['summary']['total_quantity']);
        $this->assertEquals(120000, $data['summary']['total_cost_value']);
        $this->assertEquals(180000, $data['summary']['total_retail_value']);
        $this->assertEquals(60000, $data['summary']['expected_gross_margin']);
        $this->assertSame(10, $data['summary']['low_stock_count']);

        // التحقق من البحث بالاسم أو الكود
        $searchRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/reports/stock?search=PRD-0120');

        $searchRes->assertStatus(200);
        $searchData = $searchRes->json('data');
        $this->assertCount(1, $searchData['products']);
        $this->assertSame('PRD-0120', $searchData['products'][0]['code']);
    }
}
