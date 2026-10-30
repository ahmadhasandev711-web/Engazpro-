<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\StockTransferStatus;
use App\Models\Branch;
use App\Models\BranchStock;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\Subscription;
use App\Models\User;
use App\Services\StockTransferService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DataIntegrityWave2Test extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $fromBranch;
    protected Branch $toBranch;
    protected Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'تاجر الموجة 2',
            'phone' => '01011112222',
            'password' => bcrypt('password123'),
        ]);

        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->fromBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع الإرسال',
            'code' => 'BR-01',
            'type' => BranchType::STORE,
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->toBranch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'فرع الاستلام',
            'code' => 'BR-02',
            'type' => BranchType::STORE,
            'is_main' => false,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف تجربة أمان',
            'purchase_price' => 50,
            'sale_price' => 100,
            'quantity' => 20,
        ]);
    }

    /**
     * Item 1 (Regression Guard): Transfer receipt and cancellation update branch stocks consistently
     */
    public function test_transfer_receipt_and_cancellation_update_branch_stock_consistently(): void
    {
        $service = app(StockTransferService::class);

        // 1. إنشاء تحويل
        $transfer = StockTransfer::create([
            'user_id' => $this->owner->id,
            'transfer_number' => 'TRF-00001',
            'from_branch_id' => $this->fromBranch->id,
            'to_branch_id' => $this->toBranch->id,
            'status' => StockTransferStatus::IN_TRANSIT,
            'created_by' => $this->owner->id,
            'transferred_at' => now(),
        ]);

        StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $this->product->id,
            'quantity_sent' => 5,
        ]);

        // استلام التحويل في فرع الوجهة
        $receivedTransfer = $service->receiveTransfer($this->owner, $transfer);
        $this->assertEquals(StockTransferStatus::RECEIVED, $receivedTransfer->status);

        $toStock = BranchStock::where('branch_id', $this->toBranch->id)
            ->where('product_id', $this->product->id)
            ->first();
        $this->assertNotNull($toStock);
        $this->assertEquals(5, $toStock->quantity);

        // 2. تجربة إلغاء تحويل آخر وإرجاعه لفرع المصدر
        $transfer2 = StockTransfer::create([
            'user_id' => $this->owner->id,
            'transfer_number' => 'TRF-00002',
            'from_branch_id' => $this->fromBranch->id,
            'to_branch_id' => $this->toBranch->id,
            'status' => StockTransferStatus::IN_TRANSIT,
            'created_by' => $this->owner->id,
            'transferred_at' => now(),
        ]);

        StockTransferItem::create([
            'stock_transfer_id' => $transfer2->id,
            'product_id' => $this->product->id,
            'quantity_sent' => 3,
        ]);

        $cancelledTransfer = $service->cancelTransfer($this->owner, $transfer2, 'إلغاء للاختبار');
        $this->assertEquals(StockTransferStatus::CANCELLED, $cancelledTransfer->status);

        $fromStock = BranchStock::where('branch_id', $this->fromBranch->id)
            ->where('product_id', $this->product->id)
            ->first();
        $this->assertNotNull($fromStock);
        $this->assertEquals(3, $fromStock->quantity);
    }
}
