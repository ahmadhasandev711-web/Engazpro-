<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Party;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductAndPartyCrudTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected string $token;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create([
            'name' => 'تاجر معتمد',
            'phone' => '01011112222',
            'password' => bcrypt('password123'),
        ]);

        Subscription::create([
            'user_id' => $this->user->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->token = $this->user->createToken('test_token')->plainTextToken;
    }

    public function test_can_create_product_with_initial_stock_and_movement(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/products', [
                'name' => 'شاي العروسة 250جم',
                'barcode' => '6221234567890',
                'purchase_price' => 45.00,
                'sale_price' => 55.00,
                'min_sale_price' => 50.00,
                'quantity' => 20.00,
                'min_quantity' => 5.00,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'شاي العروسة 250جم');

        $this->assertEquals(20.00, $response->json('data.quantity'));

        $productId = $response->json('data.id');

        $this->assertDatabaseHas('products', [
            'id' => $productId,
            'quantity' => 20.00,
        ]);

        $this->assertDatabaseHas('stock_movements', [
            'product_id' => $productId,
            'type' => 'IN',
            'source_type' => 'INITIAL',
            'quantity' => 20.00,
        ]);
    }

    public function test_can_delete_unused_product(): void
    {
        $product = Product::create([
            'user_id' => $this->user->id,
            'name' => 'صنف غير مستخدم',
            'purchase_price' => 10.00,
            'sale_price' => 15.00,
            'quantity' => 0,
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->deleteJson("/api/products/{$product->id}");

        $response->assertStatus(200)
            ->assertJsonPath('success', true);

        $this->assertSoftDeleted('products', ['id' => $product->id]);
    }

    public function test_strict_guard_prevents_deleting_product_with_movements(): void
    {
        $product = Product::create([
            'user_id' => $this->user->id,
            'name' => 'صنف عليه حركة بيع',
            'purchase_price' => 100.00,
            'sale_price' => 120.00,
            'quantity' => 10.00,
        ]);

        // محاكاة وجود فاتورة وبند فاتورة للصنف
        $invoice = Invoice::create([
            'user_id' => $this->user->id,
            'invoice_number' => 'INV-00001',
            'type' => 'SALE',
            'date' => now()->toDateString(),
            'subtotal' => 120.00,
            'total' => 120.00,
            'paid_amount' => 120.00,
        ]);

        $invoice->items()->create([
            'product_id' => $product->id,
            'product_name' => $product->name,
            'quantity' => 1.00,
            'unit_price' => 120.00,
            'total' => 120.00,
        ]);

        // محاولة الحذف
        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->deleteJson("/api/products/{$product->id}");

        $response->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'لا يمكن حذف هذا الصنف لوجود حركات وفواتير مرتبطة به، يمكنك تعديل بياناته أو تصفير كميته بدلاً من حذفه.');

        // التأكد من أن الصنف لم يُحذف
        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'deleted_at' => null,
        ]);
    }

    public function test_can_create_customer_with_initial_balance_and_ledger_entry(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/parties', [
                'type' => 'CUSTOMER',
                'name' => 'سوبر ماركت الأمانة',
                'phone' => '01223344556',
                'initial_balance' => 500.00, // عليه 500 جنيه
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'سوبر ماركت الأمانة');

        $this->assertEquals(500.00, $response->json('data.balance'));

        $partyId = $response->json('data.id');

        $this->assertDatabaseHas('ledger_entries', [
            'party_id' => $partyId,
            'source_type' => 'INITIAL',
            'debit' => 500.00,
            'credit' => 0.00,
            'balance_after' => 500.00,
        ]);
    }

    public function test_strict_guard_prevents_deleting_party_with_balance(): void
    {
        $customer = Party::create([
            'user_id' => $this->user->id,
            'type' => 'CUSTOMER',
            'name' => 'عميل مدين',
            'balance' => 250.00,
        ]);

        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->deleteJson("/api/parties/{$customer->id}");

        $response->assertStatus(422)
            ->assertJsonPath('success', false);

        $this->assertDatabaseHas('parties', [
            'id' => $customer->id,
            'deleted_at' => null,
        ]);
    }

    public function test_can_create_courier_party_and_retrieve_via_type_filter(): void
    {
        $response = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->postJson('/api/parties', [
                'type' => 'COURIER',
                'name' => 'شركة طيارة للشحن السريع',
                'phone' => '01099887766',
                'notes' => 'شركة شحن محلية للمحافظات',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'شركة طيارة للشحن السريع')
            ->assertJsonPath('data.type', 'COURIER');

        $courierId = $response->json('data.id');

        $this->assertDatabaseHas('parties', [
            'id' => $courierId,
            'type' => 'COURIER',
        ]);

        // Verify retrieval via type=COURIER
        $listResponse = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson('/api/parties?type=COURIER');

        $listResponse->assertStatus(200)
            ->assertJsonPath('success', true);

        $data = $listResponse->json('data');
        $this->assertTrue(collect($data)->contains('id', $courierId));

        // Verify couriers are NOT returned when requesting customers
        $customerListResponse = $this->withHeader('Authorization', "Bearer {$this->token}")
            ->getJson('/api/parties?type=CUSTOMER');
        $this->assertFalse(collect($customerListResponse->json('data'))->contains('id', $courierId));
    }
}
