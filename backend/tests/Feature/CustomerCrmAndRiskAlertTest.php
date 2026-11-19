<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\CrmRiskLevel;
use App\Enums\CustomerInteractionChannel;
use App\Enums\CustomerTier;
use App\Enums\EcommercePlatform;
use App\Enums\InvoiceType;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use App\Models\Branch;
use App\Models\Invoice;
use App\Models\OnlineOrder;
use App\Models\Party;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerCrmAndRiskAlertTest extends TestCase
{
    use RefreshDatabase;

    private User $ownerA;
    private User $ownerB;
    private Branch $branchA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ownerA = $this->createOwner('01060000001');
        $this->ownerB = $this->createOwner('01070000001');
        $this->branchA = Branch::create([
            'user_id' => $this->ownerA->id,
            'name' => 'فرع القاهرة',
            'code' => 'CAI-1',
            'type' => BranchType::STORE->value,
            'is_main' => true,
            'is_active' => true,
        ]);
    }

    private function createOwner(string $phone): User
    {
        $owner = User::factory()->create([
            'role' => UserRole::OWNER->value,
            'phone' => $phone,
            'owner_id' => null,
            'status' => UserStatus::ACTIVE->value,
            'ecommerce_enabled' => true,
        ]);

        Subscription::create([
            'user_id' => $owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => SubscriptionStatus::ACTIVE->value,
            'plan' => 'PRO',
        ]);

        return $owner;
    }

    public function test_auto_tiering_classifies_vip_repeat_high_cancellation_and_blacklisted_customers(): void
    {
        $vip = Party::create(['user_id' => $this->ownerA->id, 'type' => PartyType::CUSTOMER->value, 'name' => 'عميل VIP', 'phone' => '01011110001']);
        $risk = Party::create(['user_id' => $this->ownerA->id, 'type' => PartyType::CUSTOMER->value, 'name' => 'عميل رافض', 'phone' => '01011110002']);

        for ($i = 1; $i <= 5; $i++) {
            OnlineOrder::create([
                'user_id' => $this->ownerA->id, 'platform' => EcommercePlatform::SHOPIFY->value,
                'external_order_id' => "SH-VIP-{$i}", 'party_id' => $vip->id, 'branch_id' => $this->branchA->id,
                'status' => WcOrderStatus::DELIVERED->value, 'payment_status' => WcPaymentStatus::COLLECTED->value,
                'customer_phone' => '01011110001', 'total' => 1200,
            ]);
        }

        for ($i = 1; $i <= 3; $i++) {
            OnlineOrder::create([
                'user_id' => $this->ownerA->id, 'platform' => EcommercePlatform::WOOCOMMERCE->value,
                'external_order_id' => "WC-BLK-{$i}", 'party_id' => $risk->id, 'branch_id' => $this->branchA->id,
                'status' => WcOrderStatus::CANCELLED->value, 'payment_status' => WcPaymentStatus::PENDING_COD->value,
                'customer_phone' => '01011110002', 'total' => 400,
            ]);
        }

        Sanctum::actingAs($this->ownerA);
        $vipRes = $this->getJson('/api/parties?type=' . PartyType::CUSTOMER->value . '&crm_tier=' . CustomerTier::VIP->value)->assertOk();
        $this->assertCount(1, $vipRes->json('data'));
        $this->assertEquals(CustomerTier::VIP->value, $vipRes->json('data.0.crm_metrics.effective_tier'));
        $this->assertEquals(6000.0, (float) $vipRes->json('data.0.crm_metrics.total_spent'));

        $blkRes = $this->getJson('/api/parties?type=' . PartyType::CUSTOMER->value . '&crm_tier=' . CustomerTier::BLACKLISTED->value)->assertOk();
        $this->assertCount(1, $blkRes->json('data'));
        $this->assertEquals(CrmRiskLevel::HIGH->value, $blkRes->json('data.0.crm_metrics.risk_level'));
        $this->assertTrue((bool) $blkRes->json('data.0.crm_metrics.show_warning'));
    }

    public function test_online_orders_attach_phone_matched_risk_alert_without_n_plus_one_or_mandob_phone_leak(): void
    {
        $mandob = User::factory()->create([
            'owner_id' => $this->ownerA->id, 'branch_id' => $this->branchA->id,
            'role' => UserRole::MANDOB->value, 'status' => UserStatus::ACTIVE->value,
        ]);

        // Unlinked previous returned order sharing same phone
        OnlineOrder::create([
            'user_id' => $this->ownerA->id, 'platform' => EcommercePlatform::WOOCOMMERCE->value,
            'external_order_id' => 'WC-RET-1', 'branch_id' => $this->branchA->id,
            'status' => WcOrderStatus::RETURNED->value, 'payment_status' => WcPaymentStatus::PENDING_COD->value,
            'customer_name' => 'عميل متقلب', 'customer_phone' => '01099998888', 'total' => 300,
        ]);
        OnlineOrder::create([
            'user_id' => $this->ownerA->id, 'platform' => EcommercePlatform::WOOCOMMERCE->value,
            'external_order_id' => 'WC-RET-2', 'branch_id' => $this->branchA->id,
            'status' => WcOrderStatus::CANCELLED->value, 'payment_status' => WcPaymentStatus::PENDING_COD->value,
            'customer_name' => 'عميل متقلب', 'customer_phone' => '01099998888', 'total' => 350,
        ]);
        $pending = OnlineOrder::create([
            'user_id' => $this->ownerA->id, 'platform' => EcommercePlatform::WOOCOMMERCE->value,
            'external_order_id' => 'WC-NEW-3', 'branch_id' => $this->branchA->id, 'mandob_id' => $mandob->id,
            'status' => WcOrderStatus::PENDING_CONFIRMATION->value, 'payment_status' => WcPaymentStatus::PENDING_COD->value,
            'customer_name' => 'عميل متقلب', 'customer_phone' => '01099998888', 'total' => 450,
        ]);

        DB::enableQueryLog();
        DB::flushQueryLog();
        Sanctum::actingAs($this->ownerA);
        $res = $this->getJson('/api/online-orders')->assertOk();
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();

        $this->assertLessThanOrEqual(16, $queries);
        $first = collect($res->json('data.data'))->firstWhere('id', $pending->id);
        $this->assertTrue((bool) $first['customer_crm']['show_warning']);
        $this->assertEquals(CustomerTier::HIGH_CANCELLATION->value, $first['customer_crm']['effective_tier']);
        $this->assertEquals(2, $first['customer_crm']['cancelled_or_returned_count']);
    }

    public function test_crm_interactions_crud_manual_tier_override_and_tenant_isolation(): void
    {
        $custA = Party::create(['user_id' => $this->ownerA->id, 'type' => PartyType::CUSTOMER->value, 'name' => 'عميل متابعة', 'phone' => '01022223333']);
        $custB = Party::create(['user_id' => $this->ownerB->id, 'type' => PartyType::CUSTOMER->value, 'name' => 'عميل متجر آخر', 'phone' => '01033334444']);

        Sanctum::actingAs($this->ownerA);
        $created = $this->postJson("/api/parties/{$custA->id}/interactions", [
            'channel' => CustomerInteractionChannel::CALL->value,
            'notes' => 'تم الاتفاق على التسليم الساعة 5 مساءً',
            'follow_up_at' => now()->addDay()->toIso8601String(),
        ])->assertStatus(201);

        $interactionId = $created->json('data.id');
        $this->patchJson("/api/parties/{$custA->id}/tier", ['tier' => CustomerTier::VIP->value])
            ->assertOk()
            ->assertJsonPath('data.crm_metrics.effective_tier', CustomerTier::VIP->value)
            ->assertJsonPath('data.crm_metrics.is_manual_override', true);

        $profile = $this->getJson("/api/parties/{$custA->id}/crm")->assertOk();
        $this->assertCount(1, $profile->json('interactions'));

        $this->deleteJson("/api/parties/{$custA->id}/interactions/{$interactionId}")->assertOk();
        $this->assertDatabaseMissing('party_interactions', ['id' => $interactionId]);

        // Tenant B isolation check
        $this->getJson("/api/parties/{$custB->id}/crm")->assertStatus(404);
        $this->postJson("/api/parties/{$custB->id}/interactions", [
            'channel' => CustomerInteractionChannel::NOTE->value,
            'notes' => 'اختراق',
        ])->assertStatus(404);
    }

    public function test_pos_sale_invoices_also_contribute_to_customer_crm_tiering(): void
    {
        $cust = Party::create(['user_id' => $this->ownerA->id, 'type' => PartyType::CUSTOMER->value, 'name' => 'عميل صالة', 'phone' => '01044445555']);

        for ($i = 1; $i <= 2; $i++) {
            Invoice::create([
                'user_id' => $this->ownerA->id, 'branch_id' => $this->branchA->id, 'party_id' => $cust->id,
                'created_by' => $this->ownerA->id, 'invoice_number' => "INV-CRM-{$i}",
                'type' => InvoiceType::SALE->value, 'payment_method' => PaymentMethod::CASH->value,
                'subtotal' => 500, 'total' => 500, 'paid_amount' => 500, 'date' => now()->toDateString(),
            ]);
        }

        Sanctum::actingAs($this->ownerA);
        $res = $this->getJson("/api/parties/{$cust->id}")->assertOk();
        $this->assertEquals(CustomerTier::REPEAT->value, $res->json('data.crm_metrics.effective_tier'));
        $this->assertEquals(1000.0, (float) $res->json('data.crm_metrics.total_spent'));
    }
}
