<?php

namespace Tests\Feature;

use App\Models\Party;
use App\Models\Product;
use App\Models\StockMovement;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IdempotencyTest extends TestCase
{
    use RefreshDatabase;

    protected User $user;
    protected Party $customer;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create([
            'email' => 'owner@example.com',
            'role' => 'OWNER',
            'status' => 'ACTIVE',
        ]);
        Subscription::create([
            'user_id' => $this->user->id,
            'start_date' => now()->subDay(),
            'end_date' => now()->addYear(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->customer = Party::create([
            'user_id' => $this->user->id,
            'name' => 'عميل تجريبي',
            'type' => 'CUSTOMER',
            'phone' => '01011112222',
            'balance' => 0,
        ]);

        $this->product = Product::create([
            'user_id' => $this->user->id,
            'name' => 'منتج تجريبي',
            'code' => 'PRD-001',
            'unit' => 'قطعة',
            'purchase_price' => 50,
            'sale_price' => 100,
            'quantity' => 20,
        ]);
    }

    public function test_invoice_creation_is_idempotent(): void
    {
        $payload = [
            'type' => 'SALE',
            'party_id' => $this->customer->id,
            'date' => now()->toDateString(),
            'payment_method' => 'CASH',
            'paid_amount' => 200,
            'idempotency_key' => 'idem-inv-12345',
            'items' => [
                [
                    'product_id' => $this->product->id,
                    'quantity' => 2,
                    'unit_price' => 100,
                ],
            ],
        ];

        // First call
        $res1 = $this->actingAs($this->user)->postJson('/api/invoices', $payload);
        $res1->assertStatus(201);
        $invoiceId = $res1->json('data.id');

        // Verify stock deducted once: 20 - 2 = 18
        $this->assertEquals(18, $this->product->fresh()->quantity);
        $this->assertEquals(1, StockMovement::where('product_id', $this->product->id)->count());

        // Second call with EXACT SAME idempotency_key
        $res2 = $this->actingAs($this->user)->postJson('/api/invoices', $payload);
        $this->assertTrue(in_array($res2->status(), [200, 201]));
        $this->assertEquals($invoiceId, $res2->json('data.id'));

        // Stock must STILL be 18, not 16!
        $this->assertEquals(18, $this->product->fresh()->quantity);
        // Movements must STILL be 1, not 2!
        $this->assertEquals(1, StockMovement::where('product_id', $this->product->id)->count());
    }

    public function test_payment_creation_is_idempotent(): void
    {
        $payload = [
            'party_id' => $this->customer->id,
            'type' => 'RECEIPT',
            'amount' => 300,
            'method' => 'CASH',
            'date' => now()->toDateString(),
            'idempotency_key' => 'idem-pay-99999',
        ];

        // First call
        $res1 = $this->actingAs($this->user)->postJson('/api/payments', $payload);
        $res1->assertStatus(201);
        $paymentId = $res1->json('data.id');

        // Balance changed by -300
        $this->assertEquals(-300, (float) $this->customer->fresh()->balance);

        // Second call with same idempotency_key
        $res2 = $this->actingAs($this->user)->postJson('/api/payments', $payload);
        $this->assertTrue(in_array($res2->status(), [200, 201]));
        $this->assertEquals($paymentId, $res2->json('data.id'));

        // Balance must STILL be -300, NOT -600!
        $this->assertEquals(-300, (float) $this->customer->fresh()->balance);
    }

    public function test_idempotency_keys_are_scoped_per_user_store(): void
    {
        $otherUser = User::factory()->create([
            'email' => 'other@example.com',
            'role' => 'OWNER',
            'status' => 'ACTIVE',
        ]);
        Subscription::create([
            'user_id' => $otherUser->id,
            'start_date' => now()->subDay(),
            'end_date' => now()->addYear(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $otherParty = Party::create([
            'user_id' => $otherUser->id,
            'name' => 'عميل آخر',
            'type' => 'CUSTOMER',
            'balance' => 0,
        ]);

        $otherProduct = Product::create([
            'user_id' => $otherUser->id,
            'name' => 'منتج آخر',
            'code' => 'PRD-002',
            'sale_price' => 100,
            'quantity' => 10,
        ]);

        $key = 'shared-idem-key';

        // User 1 creates invoice
        $res1 = $this->actingAs($this->user)->postJson('/api/invoices', [
            'type' => 'SALE',
            'idempotency_key' => $key,
            'items' => [['product_id' => $this->product->id, 'quantity' => 1, 'unit_price' => 100]],
            'date' => now()->toDateString(),
        ]);
        $res1->assertStatus(201);

        // User 2 creates invoice with same key (must succeed because user_id differs)
        $res2 = $this->actingAs($otherUser)->postJson('/api/invoices', [
            'type' => 'SALE',
            'idempotency_key' => $key,
            'items' => [['product_id' => $otherProduct->id, 'quantity' => 1, 'unit_price' => 100]],
            'date' => now()->toDateString(),
        ]);
        $res2->assertStatus(201);

        $this->assertNotEquals($res1->json('data.id'), $res2->json('data.id'));
    }
}