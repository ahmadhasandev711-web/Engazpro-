<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\StockTransferStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\User;
use App\Models\WcOrder;
use App\Enums\WcOrderStatus;
use App\Enums\WcPaymentStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MultiTenancyAndBranchIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected User $ownerA;
    protected User $ownerB;
    protected Branch $branchA1;
    protected Branch $branchA2;
    protected Branch $branchB1;
    protected User $managerA1;
    protected User $managerA2;
    protected User $cashierA1;

    protected function setUp(): void
    {
        parent::setUp();

        // Store A
        $this->ownerA = User::create([
            'name' => 'صاحب المتجر أ',
            'phone' => '01011111111',
            'password' => bcrypt('password123'),
            'role' => 'OWNER',
            'status' => 'ACTIVE',
        ]);
        Subscription::create([
            'user_id' => $this->ownerA->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ENTERPRISE',
        ]);

        $this->branchA1 = Branch::create([
            'user_id' => $this->ownerA->id,
            'name' => 'فرع أ1 الرئيسي',
            'code' => 'BR-A1',
            'type' => BranchType::STORE,
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->branchA2 = Branch::create([
            'user_id' => $this->ownerA->id,
            'name' => 'فرع أ2 الفرعي',
            'code' => 'BR-A2',
            'type' => BranchType::STORE,
            'is_main' => false,
            'is_active' => true,
        ]);

        $this->managerA1 = User::create([
            'name' => 'مدير فرع أ1',
            'phone' => '01011111112',
            'password' => bcrypt('password123'),
            'role' => 'MANAGER',
            'status' => 'ACTIVE',
            'owner_id' => $this->ownerA->id,
            'branch_id' => $this->branchA1->id,
        ]);

        $this->managerA2 = User::create([
            'name' => 'مدير فرع أ2',
            'phone' => '01011111113',
            'password' => bcrypt('password123'),
            'role' => 'MANAGER',
            'status' => 'ACTIVE',
            'owner_id' => $this->ownerA->id,
            'branch_id' => $this->branchA2->id,
        ]);

        $this->cashierA1 = User::create([
            'name' => 'كاشير فرع أ1',
            'phone' => '01011111114',
            'password' => bcrypt('password123'),
            'role' => 'CASHIER',
            'status' => 'ACTIVE',
            'owner_id' => $this->ownerA->id,
            'branch_id' => $this->branchA1->id,
        ]);

        // Store B (Tenant B)
        $this->ownerB = User::create([
            'name' => 'صاحب المتجر ب',
            'phone' => '01022222221',
            'password' => bcrypt('password123'),
            'role' => 'OWNER',
            'status' => 'ACTIVE',
        ]);
        Subscription::create([
            'user_id' => $this->ownerB->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ENTERPRISE',
        ]);

        $this->branchB1 = Branch::create([
            'user_id' => $this->ownerB->id,
            'name' => 'فرع ب1 الرئيسي',
            'code' => 'BR-B1',
            'type' => BranchType::STORE,
            'is_main' => true,
            'is_active' => true,
        ]);
    }

    public function test_tenant_b_cannot_access_tenant_a_invoice(): void
    {
        $invA = Invoice::create([
            'user_id' => $this->ownerA->id,
            'created_by' => $this->ownerA->id,
            'branch_id' => $this->branchA1->id,
            'invoice_number' => 'INV-A-1001',
            'type' => 'SALE',
            'date' => now()->toDateString(),
            'total' => 500,
            'paid_amount' => 500,
            'remaining_amount' => 0,
            'payment_method' => PaymentMethod::CASH->value,
        ]);

        // Tenant B trying to view Tenant A's invoice -> 404 or 403
        $response = $this->actingAs($this->ownerB)->getJson("/api/invoices/{$invA->id}");
        $this->assertTrue(in_array($response->status(), [403, 404]));
    }

    public function test_tenant_b_cannot_access_or_view_tenant_a_parties_and_couriers(): void
    {
        $courierA = Party::create([
            'user_id' => $this->ownerA->id,
            'name' => 'شركة أكسبريس أ',
            'type' => PartyType::COURIER->value,
            'phone' => '01055555555',
        ]);

        // Tenant B lists parties -> courierA should not appear
        $res = $this->actingAs($this->ownerB)->getJson('/api/parties');
        $res->assertStatus(200);
        $this->assertEmpty($res->json('data'));

        // Tenant B attempts to view courier A manifest -> 404
        $resManifest = $this->actingAs($this->ownerB)->getJson("/api/couriers/{$courierA->id}/manifest");
        $resManifest->assertStatus(404);
    }

    public function test_branch_manager_is_strictly_isolated_to_own_branch_invoices(): void
    {
        // Invoice in Branch A1
        $invA1 = Invoice::create([
            'user_id' => $this->ownerA->id,
            'created_by' => $this->ownerA->id,
            'branch_id' => $this->branchA1->id,
            'invoice_number' => 'INV-A1-001',
            'type' => 'SALE',
            'date' => now()->toDateString(),
            'total' => 200,
            'paid_amount' => 200,
            'remaining_amount' => 0,
            'payment_method' => PaymentMethod::CASH->value,
        ]);

        // Invoice in Branch A2
        $invA2 = Invoice::create([
            'user_id' => $this->ownerA->id,
            'created_by' => $this->ownerA->id,
            'branch_id' => $this->branchA2->id,
            'invoice_number' => 'INV-A2-001',
            'type' => 'SALE',
            'date' => now()->toDateString(),
            'total' => 350,
            'paid_amount' => 350,
            'remaining_amount' => 0,
            'payment_method' => PaymentMethod::CASH->value,
        ]);

        // Manager A1 listing invoices: must ONLY see invA1
        $resA1 = $this->actingAs($this->managerA1)->getJson('/api/invoices');
        $resA1->assertStatus(200);
        $this->assertCount(1, $resA1->json('data'));
        $this->assertEquals('INV-A1-001', $resA1->json('data.0.invoice_number'));

        // Manager A1 directly viewing invA2 (Branch A2) -> 403 Forbidden!
        $resForbidden = $this->actingAs($this->managerA1)->getJson("/api/invoices/{$invA2->id}");
        $resForbidden->assertStatus(403);

        // Manager A2 listing invoices: must ONLY see invA2
        $resA2 = $this->actingAs($this->managerA2)->getJson('/api/invoices');
        $resA2->assertStatus(200);
        $this->assertCount(1, $resA2->json('data'));
        $this->assertEquals('INV-A2-001', $resA2->json('data.0.invoice_number'));

        // Owner can see both invoices, or filter by branch_id
        $resOwnerAll = $this->actingAs($this->ownerA)->getJson('/api/invoices');
        $resOwnerAll->assertStatus(200);
        $this->assertCount(2, $resOwnerAll->json('data'));

        $resOwnerFiltered = $this->actingAs($this->ownerA)->getJson("/api/invoices?branch_id={$this->branchA2->id}");
        $resOwnerFiltered->assertStatus(200);
        $this->assertCount(1, $resOwnerFiltered->json('data'));
        $this->assertEquals('INV-A2-001', $resOwnerFiltered->json('data.0.invoice_number'));
    }

    public function test_courier_manifest_is_branch_isolated_for_managers(): void
    {
        $courier = Party::create([
            'user_id' => $this->ownerA->id,
            'name' => 'شركة المدار للشحن',
            'type' => PartyType::COURIER->value,
            'phone' => '01099998888',
        ]);

        // Order 1 in Branch A1
        WcOrder::create([
            'user_id' => $this->ownerA->id,
            'branch_id' => $this->branchA1->id,
            'wc_order_id' => 901,
            'customer_name' => 'عميل فرع 1',
            'total' => 150,
            'shipping_cost' => 30,
            'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'courier_party_id' => $courier->id,
        ]);

        // Order 2 in Branch A2
        WcOrder::create([
            'user_id' => $this->ownerA->id,
            'branch_id' => $this->branchA2->id,
            'wc_order_id' => 902,
            'customer_name' => 'عميل فرع 2',
            'total' => 250,
            'shipping_cost' => 40,
            'status' => WcOrderStatus::SHIPPED_VIA_COURIER,
            'payment_status' => WcPaymentStatus::PENDING_COD,
            'courier_party_id' => $courier->id,
        ]);

        // Manager A1 accesses courier manifest -> should ONLY see Order 901
        $resM1 = $this->actingAs($this->managerA1)->getJson("/api/couriers/{$courier->id}/manifest");
        $resM1->assertStatus(200);
        $shipmentsM1 = $resM1->json('shipments');
        $this->assertCount(1, $shipmentsM1);
        $this->assertEquals(901, $shipmentsM1[0]['wc_order_id']);

        // Manager A2 accesses courier manifest -> should ONLY see Order 902
        $resM2 = $this->actingAs($this->managerA2)->getJson("/api/couriers/{$courier->id}/manifest");
        $resM2->assertStatus(200);
        $shipmentsM2 = $resM2->json('shipments');
        $this->assertCount(1, $shipmentsM2);
        $this->assertEquals(902, $shipmentsM2[0]['wc_order_id']);

        // Owner can see all shipments
        $resOwner = $this->actingAs($this->ownerA)->getJson("/api/couriers/{$courier->id}/manifest");
        $resOwner->assertStatus(200);
        $this->assertCount(2, $resOwner->json('shipments'));

        // Owner can filter by branch
        $resOwnerFiltered = $this->actingAs($this->ownerA)->getJson("/api/couriers/{$courier->id}/manifest?branch_id={$this->branchA1->id}");
        $resOwnerFiltered->assertStatus(200);
        $this->assertCount(1, $resOwnerFiltered->json('shipments'));
        $this->assertEquals(901, $resOwnerFiltered->json('shipments.0.wc_order_id'));
    }

    public function test_stock_transfer_branch_isolation_and_receiving_authorization(): void
    {
        $product = Product::create([
            'user_id' => $this->ownerA->id,
            'name' => 'عطر مميز',
            'purchase_price' => 50,
            'sale_price' => 100,
            'quantity' => 50,
        ]);

        BranchStock::create([
            'branch_id' => $this->branchA1->id,
            'product_id' => $product->id,
            'quantity' => 30,
        ]);

        // Transfer from A1 to A2
        $transfer = StockTransfer::create([
            'user_id' => $this->ownerA->id,
            'transfer_number' => 'TRF-0001',
            'from_branch_id' => $this->branchA1->id,
            'to_branch_id' => $this->branchA2->id,
            'status' => StockTransferStatus::IN_TRANSIT,
            'created_by' => $this->ownerA->id,
            'transferred_at' => now(),
        ]);

        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'quantity_sent' => 10,
        ]);

        // Manager A1 (Branch 1) CANNOT receive goods destined for Branch 2!
        $receiveResForbidden = $this->actingAs($this->managerA1)->postJson("/api/stock-transfers/{$transfer->id}/receive", [
            'items' => [
                ['quantity_received' => 10],
            ],
        ]);
        $receiveResForbidden->assertStatus(403);

        // Manager A2 (Branch 2 - Destination) CAN receive the goods!
        $receiveResAllowed = $this->actingAs($this->managerA2)->postJson("/api/stock-transfers/{$transfer->id}/receive", [
            'items' => [
                ['quantity_received' => 10],
            ],
        ]);
        $receiveResAllowed->assertStatus(200)
            ->assertJsonPath('success', true);

        // Manager A1 cannot dispatch transfers from Branch A2
        $dispatchForbidden = $this->actingAs($this->managerA1)->postJson('/api/stock-transfers', [
            'from_branch_id' => $this->branchA2->id,
            'to_branch_id' => $this->branchA1->id,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity_sent' => 5,
                ],
            ],
        ]);
        // DomainException caught or status 400/422
        $this->assertTrue(in_array($dispatchForbidden->status(), [400, 422, 403]));
    }

    public function test_only_owner_or_admin_can_delete_party(): void
    {
        $customer = Party::create([
            'user_id' => $this->ownerA->id,
            'name' => 'عميل عادي',
            'type' => PartyType::CUSTOMER->value,
            'phone' => '01012345678',
        ]);

        // Cashier tries to delete party -> 403
        $cashierRes = $this->actingAs($this->cashierA1)->deleteJson("/api/parties/{$customer->id}");
        $cashierRes->assertStatus(403);

        // Owner deletes party -> 200
        $ownerRes = $this->actingAs($this->ownerA)->deleteJson("/api/parties/{$customer->id}");
        $ownerRes->assertStatus(200);

        $this->assertSoftDeleted('parties', ['id' => $customer->id]);
    }
}
