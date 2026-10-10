<?php

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Category;
use App\Models\Party;
use App\Models\Product;
use App\Models\Treasury;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StoreBootstrapTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_user_registration_automatically_bootstraps_complete_store(): void
    {
        $payload = [
            'name' => 'متجر النور للملابس',
            'phone' => '01099887766',
            'email' => 'alnoor.store@test.com',
            'password' => 'secret123456',
        ];

        $res = $this->postJson('/api/auth/register', $payload);

        $res->assertStatus(201)
            ->assertJsonPath('success', true);

        $token = $res->json('data.token');
        $userId = $res->json('data.user.id');
        $user = User::findOrFail($userId);

        // 1. Check Trial Subscription
        $this->assertNotNull($user->subscription);
        $this->assertEquals('ACTIVE', $user->subscription->status);
        $this->assertEquals('TRIAL', $user->subscription->plan);

        // 2. Check Main Branch
        $mainBranch = Branch::where('user_id', $user->id)->where('is_main', true)->first();
        $this->assertNotNull($mainBranch);
        $this->assertEquals('الفرع الرئيسي', $mainBranch->name);
        $this->assertEquals('MAIN', $mainBranch->code);
        $this->assertEquals($mainBranch->id, $user->branch_id);

        // 3. Check Treasuries
        $mainTreasury = Treasury::where('user_id', $user->id)->where('type', 'MAIN')->first();
        $this->assertNotNull($mainTreasury);
        $this->assertEquals('الخزينة المركزية العامة (الإدارة)', $mainTreasury->name);

        $drawer = Treasury::where('user_id', $user->id)->where('type', 'CASHIER_DRAWER')->first();
        $this->assertNotNull($drawer);
        $this->assertEquals('درج الكاشير', $drawer->name);

        // 4. Check Default Cash Customer
        $customer = Party::where('user_id', $user->id)->where('type', 'CUSTOMER')->first();
        $this->assertNotNull($customer);
        $this->assertEquals('عميل نقدي عام', $customer->name);

        // 5. Check Default Category
        $category = Category::where('user_id', $user->id)->first();
        $this->assertNotNull($category);
        $this->assertEquals('عام', $category->name);

        // 6. Check Sample Clothing Product & Variants
        $sampleProduct = Product::with('variants')->where('user_id', $user->id)->first();
        $this->assertNotNull($sampleProduct);
        $this->assertEquals('تيشيرت كاجوال قطن (صنف تجريبي)', $sampleProduct->name);
        $this->assertTrue((bool) $sampleProduct->has_variants);
        $this->assertCount(3, $sampleProduct->variants);
        $this->assertEquals(33, (float) $sampleProduct->quantity); // 10 + 15 + 8 = 33

        // Verify each variant has unique barcode
        $barcodes = $sampleProduct->variants->pluck('barcode')->filter()->all();
        $this->assertCount(3, $barcodes);
        $this->assertCount(3, array_unique($barcodes));

        // 7. Verify new user can immediately open shift and sell in POS
        $firstVariant = $sampleProduct->variants()->orderBy('id', 'asc')->first();
        $initialVariantQty = (float) $firstVariant->quantity;

        $invoiceRes = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/invoices', [
                'type' => 'SALE',
                'date' => now()->toDateString(),
                'payment_method' => 'CASH',
                'party_id' => $customer->id,
                'items' => [
                    [
                        'product_id' => $sampleProduct->id,
                        'product_variant_id' => $firstVariant->id,
                        'quantity' => 1,
                        'unit_price' => $firstVariant->sale_price,
                    ],
                ],
            ]);

        $invoiceRes->assertStatus(201)
            ->assertJsonPath('success', true);

        // Verify stock deducted
        $this->assertEquals($initialVariantQty - 1, (float) $firstVariant->fresh()->quantity);
        $this->assertEquals(32, (float) $sampleProduct->fresh()->quantity);
    }
}
