<?php

namespace Tests\Feature;

use App\Exceptions\PosDomainException;
use App\Models\Invoice;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Subscription;
use App\Models\User;
use App\Services\InvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DiscountGuardAndNumberingTest extends TestCase
{
    use RefreshDatabase;

    private function createOwner(string $name, string $phone): User
    {
        $user = User::create([
            'name' => $name,
            'phone' => $phone,
            'password' => bcrypt('password123'),
            'role' => 'OWNER',
        ]);

        Subscription::create([
            'user_id' => $user->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        return $user;
    }

    private function createStaff(User $owner, string $role, string $phone): User
    {
        return User::create([
            'name' => "موظف {$role}",
            'phone' => $phone,
            'password' => bcrypt('password123'),
            'role' => $role,
            'owner_id' => $owner->id,
        ]);
    }

    private function createProduct(User $owner): Product
    {
        return Product::create([
            'user_id' => $owner->id,
            'name' => 'صنف اختبار',
            'purchase_price' => 50.00,
            'sale_price' => 80.00,
            'quantity' => 100.00,
        ]);
    }

    private function sellItems(Product $product, float $qty): array
    {
        return [
            [
                'product_id' => $product->id,
                'quantity' => $qty,
                'unit_price' => 80.00,
            ],
        ];
    }

    public function test_discount_cannot_exceed_subtotal(): void
    {
        $owner = $this->createOwner('مالك Photography', '01000100001');
        $product = $this->createProduct($owner);
        $service = app(InvoiceService::class);

        try {
            $service->createInvoice($owner, [
                'type' => 'SALE',
                'payment_method' => 'CASH',
                'items' => $this->sellItems($product, 2),
                'discount' => 999.00,
            ]);
            $this->fail('يجب رفض الخصم المتجاوز للسلة');
        } catch (PosDomainException $e) {
            $this->assertSame('DISCOUNT_EXCEEDS_SUBTOTAL', $e->getErrorCode());
            $this->assertSame(422, $e->getStatusCode());
        }

        $this->assertEquals(0, Invoice::count());
    }

    public function test_cashier_discount_is_capped_by_store_setting(): void
    {
        $owner = $this->createOwner('مالك سقف الخصم', '01000100002');
        $cashier = $this->createStaff($owner, 'CASHIER', '01000100022');
        $product = $this->createProduct($owner);
        Setting::create([
            'user_id' => $owner->id,
            'key' => 'max_discount_percent',
            'value' => '25',
        ]);
        $service = app(InvoiceService::class);

        // الكاشير فوق السقف (25% من 160 = 40): يُرفض قبل فحص الوردية
        try {
            $service->createInvoice($cashier, [
                'type' => 'SALE',
                'payment_method' => 'CASH',
                'items' => $this->sellItems($product, 2),
                'discount' => 50.00,
            ]);
            $this->fail('يجب رفض خصم الكاشير فوق السقف');
        } catch (PosDomainException $e) {
            $this->assertSame('DISCOUNT_EXCEEDS_LIMIT', $e->getErrorCode());
        }

        // الكاشير عند السقف بالضبط مع وردية مفتوحة: يُقبل
        app(\App\Services\ShiftService::class)->openShift($cashier);
        $invoice = $service->createInvoice($cashier, [
            'type' => 'SALE',
            'payment_method' => 'CASH',
            'items' => $this->sellItems($product, 2),
            'discount' => 40.00,
        ]);
        $this->assertEquals(40.00, $invoice->discount);
        $this->assertEquals(120.00, $invoice->total);
    }

    public function test_manager_bypasses_discount_cap(): void
    {
        $owner = $this->createOwner('مالك تجاوز المدير', '01000100003');
        $manager = $this->createStaff($owner, 'MANAGER', '01000100032');
        $product = $this->createProduct($owner);
        Setting::create([
            'user_id' => $owner->id,
            'key' => 'max_discount_percent',
            'value' => '5',
        ]);

        $invoice = app(InvoiceService::class)->createInvoice($manager, [
            'type' => 'SALE',
            'payment_method' => 'CASH',
            'items' => $this->sellItems($product, 2),
            'discount' => 100.00,
        ]);

        $this->assertEquals(100.00, $invoice->discount);
        $this->assertEquals(60.00, $invoice->total);
    }

    public function test_store_identity_api_round_trips_max_discount_percent(): void
    {
        $owner = $this->createOwner('مالك إعدادات الخصم', '01000100004');

        $put = $this->actingAs($owner)->putJson('/api/settings/store-identity', [
            'business_name' => 'متجر الاختبار',
            'currency' => 'ج.م',
            'max_discount_percent' => '12.5',
        ]);
        $put->assertOk();

        $res = $this->actingAs($owner)->getJson('/api/settings/store-identity');
        $res->assertOk()->assertJsonPath('data.max_discount_percent', 12.5);

        // قيمة خارج النطاق تُرفض
        $this->actingAs($owner)->putJson('/api/settings/store-identity', [
            'business_name' => 'متجر الاختبار',
            'currency' => 'ج.م',
            'max_discount_percent' => '150',
        ])->assertStatus(422);
    }

    public function test_numbering_includes_trashed_invoices_and_stays_unique(): void
    {
        $owner = $this->createOwner('مالك الترقيم', '01000100005');
        $product = $this->createProduct($owner);
        $service = app(InvoiceService::class);

        $first = $service->createInvoice($owner, [
            'type' => 'SALE',
            'payment_method' => 'CASH',
            'items' => $this->sellItems($product, 1),
        ]);
        $second = $service->createInvoice($owner, [
            'type' => 'SALE',
            'payment_method' => 'CASH',
            'items' => $this->sellItems($product, 1),
        ]);

        $this->assertSame('INV-00001', $first->invoice_number);
        $this->assertSame('INV-00002', $second->invoice_number);

        // حذف الفاتورة الثانية (ناعم) لا يعيد استخدام رقمها
        $second->delete();

        $third = $service->createInvoice($owner, [
            'type' => 'SALE',
            'payment_method' => 'CASH',
            'items' => $this->sellItems($product, 1),
        ]);
        $this->assertSame('INV-00003', $third->invoice_number);

        // فهرس تفرّد الأرقام لكل حساب يمنع أي تكرار مستقبلي
        $numbers = Invoice::withTrashed()
            ->where('user_id', $owner->id)
            ->where('type', 'SALE')
            ->pluck('invoice_number')->all();
        $this->assertSame($numbers, array_values(array_unique($numbers)));
    }
}
