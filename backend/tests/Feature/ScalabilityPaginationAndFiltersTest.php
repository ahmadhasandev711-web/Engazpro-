<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\PartyType;
use App\Enums\ProductType;
use App\Enums\StockTransferStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Party;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ScalabilityPaginationAndFiltersTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Branch $branchA;

    private Branch $branchB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'صاحب المتجر',
            'phone' => '01077665544',
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

        $this->branchA = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'MAIN-1',
            'type' => BranchType::WAREHOUSE,
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->branchB = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع المعادي',
            'code' => 'BR-2',
            'type' => BranchType::STORE,
            'is_main' => false,
            'is_active' => true,
        ]);
    }

    public function test_parties_endpoint_filters_by_balance_status_and_returns_accurate_summary(): void
    {
        for ($i = 1; $i <= 3; $i++) {
            Party::create([
                'user_id' => $this->owner->id,
                'type' => PartyType::CUSTOMER->value,
                'name' => "عميل خالص {$i}",
                'balance' => 0,
            ]);
        }

        Party::create([
            'user_id' => $this->owner->id,
            'type' => PartyType::CUSTOMER->value,
            'name' => 'عميل مدين أ',
            'balance' => 250.50,
        ]);

        Party::create([
            'user_id' => $this->owner->id,
            'type' => PartyType::CUSTOMER->value,
            'name' => 'عميل دائن ب',
            'balance' => -100.00,
        ]);

        $response = $this->actingAs($this->owner)->getJson('/api/parties?type=CUSTOMER&balance_status=WITH_BALANCE&per_page=1');

        $response->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('summary.total_count', 5)
            ->assertJsonPath('summary.with_balance_count', 2)
            ->assertJsonPath('summary.zero_balance_count', 3)
            ->assertJsonPath('summary.total_balance', 150.5);
    }

    public function test_stock_transfers_endpoint_supports_search_date_filters_and_global_summary(): void
    {
        StockTransfer::create([
            'user_id' => $this->owner->id,
            'transfer_number' => 'TRF-00101',
            'from_branch_id' => $this->branchA->id,
            'to_branch_id' => $this->branchB->id,
            'status' => StockTransferStatus::IN_TRANSIT->value,
            'created_by' => $this->owner->id,
            'transferred_at' => '2026-11-10 10:00:00',
            'notes' => 'شحنة شتوي',
        ]);

        StockTransfer::create([
            'user_id' => $this->owner->id,
            'transfer_number' => 'TRF-00102',
            'from_branch_id' => $this->branchA->id,
            'to_branch_id' => $this->branchB->id,
            'status' => StockTransferStatus::RECEIVED->value,
            'created_by' => $this->owner->id,
            'transferred_at' => '2026-11-12 10:00:00',
            'notes' => 'شحنة صيفي',
        ]);

        StockTransfer::create([
            'user_id' => $this->owner->id,
            'transfer_number' => 'TRF-00103',
            'from_branch_id' => $this->branchA->id,
            'to_branch_id' => $this->branchB->id,
            'status' => StockTransferStatus::CANCELLED->value,
            'created_by' => $this->owner->id,
            'transferred_at' => '2026-11-15 10:00:00',
            'notes' => 'ملغي للخطأ',
        ]);

        $filteredByStatus = $this->actingAs($this->owner)
            ->getJson('/api/stock-transfers?status=RECEIVED&per_page=1');

        $filteredByStatus->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('summary.total', 3)
            ->assertJsonPath('summary.in_transit_count', 1)
            ->assertJsonPath('summary.received_count', 1)
            ->assertJsonPath('summary.cancelled_count', 1);

        $filteredBySearch = $this->actingAs($this->owner)
            ->getJson('/api/stock-transfers?search=TRF-00101&date_from=2026-11-01&date_to=2026-11-11');

        $filteredBySearch->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.transfer_number', 'TRF-00101');
    }

    public function test_products_endpoint_returns_global_tab_summary_counts(): void
    {
        Product::create([
            'user_id' => $this->owner->id,
            'type' => ProductType::STANDARD->value,
            'name' => 'صنف عادي ناقص',
            'sale_price' => 100,
            'purchase_price' => 50,
            'quantity' => 2,
            'min_quantity' => 5,
        ]);

        Product::create([
            'user_id' => $this->owner->id,
            'type' => ProductType::VARIABLE->value,
            'has_variants' => true,
            'name' => 'تيشيرت مقاسات',
            'sale_price' => 200,
            'purchase_price' => 100,
            'quantity' => 20,
            'min_quantity' => 5,
        ]);

        $res = $this->actingAs($this->owner)->getJson('/api/products?per_page=1');

        $res->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('summary.all_count', 2)
            ->assertJsonPath('summary.variable_count', 1)
            ->assertJsonPath('summary.low_stock_count', 1);
    }

    public function test_stock_alerts_endpoint_paginates_low_stock_items(): void
    {
        for ($i = 1; $i <= 4; $i++) {
            $product = Product::create([
                'user_id' => $this->owner->id,
                'type' => ProductType::STANDARD->value,
                'name' => "صنف ناقص {$i}",
                'sale_price' => 50,
                'purchase_price' => 25,
                'quantity' => $i,
                'min_quantity' => 10,
            ]);

            BranchStock::create([
                'user_id' => $this->owner->id,
                'branch_id' => $this->branchA->id,
                'product_id' => $product->id,
                'quantity' => $i,
                'min_quantity' => 10,
            ]);
        }

        $page2 = $this->actingAs($this->owner)->getJson('/api/stock/alerts?per_page=2&page=2');

        $page2->assertOk()
            ->assertJsonCount(2, 'data.low_stock_items')
            ->assertJsonPath('data.low_stock_meta.current_page', 2)
            ->assertJsonPath('data.low_stock_meta.last_page', 2)
            ->assertJsonPath('data.low_stock_meta.per_page', 2)
            ->assertJsonPath('data.low_stock_meta.total', 4);
    }
}
