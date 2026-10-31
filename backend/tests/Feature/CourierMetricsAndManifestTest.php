<?php

namespace Tests\Feature;

use App\Enums\PartyType;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Branch;
use App\Models\Party;
use App\Models\Subscription;
use App\Models\User;
use App\Models\WcOrder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class CourierMetricsAndManifestTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected string $token;
    protected Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'مالك تجربة الشحن',
            'phone' => '01077778888',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER,
            'status' => UserStatus::ACTIVE,
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ANNUAL',
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع الشحن',
            'code' => 'BR-SHP',
            'is_main' => true,
        ]);

        $this->token = $this->owner->createToken('test')->plainTextToken;
    }

    public function test_courier_list_has_constant_queries_for_10_couriers_no_n_plus_one(): void
    {
        // إنشاء 10 شركات شحن
        for ($i = 1; $i <= 10; $i++) {
            $courier = Party::create([
                'user_id' => $this->owner->id,
                'name' => "شركة شحن {$i}",
                'type' => PartyType::COURIER,
                'phone' => sprintf('010000000%02d', $i),
                'balance' => 0,
            ]);

            // شحنتين لكل شركة
            WcOrder::create([
                'user_id' => $this->owner->id,
                'wc_order_id' => 1000 + $i,
                'branch_id' => $this->branch->id,
                'courier_party_id' => $courier->id,
                'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
                'payment_status' => WcPaymentStatus::PENDING_COD,
                'total' => 200,
                'shipping_cost' => 30,
            ]);
        }

        $queryCount = 0;
        DB::listen(function () use (&$queryCount) {
            $queryCount++;
        });

        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson('/api/couriers');

        $res->assertStatus(200);
        $this->assertCount(10, $res->json('data'));

        // مع حل N+1: استعلامين GROUP BY بدل 50 استعلام (الحد الأقصى للاستعلامات بالكامل بما فيها auth/user هو أقل من 10)
        $this->assertLessThanOrEqual(
            8,
            $queryCount,
            "عدد الاستعلامات يجب أن يكون ثابتاً ولا يتجاوز 8 استعلامات، الفعلي: {$queryCount}"
        );
    }

    public function test_manifest_is_paginated_to_50_and_filters_via_database(): void
    {
        $courier = Party::create([
            'user_id' => $this->owner->id,
            'name' => 'شركة فاست ديليفري',
            'type' => PartyType::COURIER,
            'phone' => '01011112222',
            'balance' => 0,
        ]);

        // إنشاء 120 شحنة (100 COD و 20 PREPAID)
        $ordersData = [];
        for ($i = 1; $i <= 120; $i++) {
            $isPrepaid = ($i <= 20);
            $ordersData[] = [
                'user_id' => $this->owner->id,
                'wc_order_id' => 5000 + $i,
                'branch_id' => $this->branch->id,
                'courier_party_id' => $courier->id,
                'status' => WcOrderStatus::SHIPPED_VIA_COURIER->value,
                'payment_status' => $isPrepaid ? WcPaymentStatus::PAID_ONLINE->value : WcPaymentStatus::PENDING_COD->value,
                'customer_name' => "عميل شحنة {$i}",
                'total' => 100,
                'shipping_cost' => 20,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }
        WcOrder::insert($ordersData);

        // 1. طلب الصفحة الأولى: يجب أن ترجع 50 شحنة فقط
        $res = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson("/api/couriers/{$courier->id}/manifest?page=1");

        $res->assertStatus(200);
        $data = $res->json();
        $this->assertCount(50, $data['shipments'], 'المانيفست يجب أن يعيد 50 شحنة فقط للصفحة');
        $this->assertSame(120, $data['metrics']['total_shipments'], 'الإجماليات محسوبة على الـ 120 كلهم');

        // 2. فلتر PREPAID في قاعدة البيانات
        $resPrepaid = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson("/api/couriers/{$courier->id}/manifest?payment_status=PREPAID");

        $resPrepaid->assertStatus(200);
        $prepaidData = $resPrepaid->json();
        $this->assertCount(20, $prepaidData['shipments'], 'فلتر PREPAID يجب أن يعيد الـ 20 شحنة المدفوعة أونلاين فقط');
        foreach ($prepaidData['shipments'] as $s) {
            $this->assertTrue($s['is_paid_online']);
        }
    }
}
