<?php

namespace Tests\Feature;

use App\Enums\BranchType;
use App\Enums\PartyType;
use App\Enums\PaymentMethod;
use App\Enums\StockTransferStatus;
use App\Enums\TreasuryTransactionType;
use App\Exceptions\PosDomainException;
use App\Exceptions\StockTransferDomainException;
use App\Models\Branch;
use App\Models\Invoice;
use App\Models\Party;
use App\Models\Payment;
use App\Models\Product;
use App\Models\StockTransfer;
use App\Models\StockTransferItem;
use App\Models\Subscription;
use App\Models\Treasury;
use App\Models\TreasuryTransaction;
use App\Models\User;
use App\Models\WooCommerceIntegration;
use App\Services\InvoiceService;
use App\Services\LedgerService;
use App\Services\PaymentService;
use App\Services\StockService;
use App\Services\StockTransferService;
use App\Support\Money;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CriticalSecurityAndInvariantsPhase1Test extends TestCase
{
    use RefreshDatabase;

    protected User $ownerA;
    protected User $ownerB;
    protected Branch $branchA;
    protected Branch $branchB;
    protected Treasury $treasuryA;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ownerA = User::create([
            'name' => 'مالك المتجر أ',
            'phone' => '01011111111',
            'password' => bcrypt('password123'),
            'role' => 'OWNER',
            'is_admin' => false,
            'status' => 'ACTIVE',
        ]);
        Subscription::create([
            'user_id' => $this->ownerA->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->branchA = Branch::create([
            'user_id' => $this->ownerA->id,
            'name' => 'فرع أ',
            'code' => 'BR-A',
            'type' => BranchType::STORE,
            'is_main' => true,
            'is_active' => true,
        ]);
        $this->ownerA->update(['branch_id' => $this->branchA->id]);

        $this->treasuryA = Treasury::create([
            'user_id' => $this->ownerA->id,
            'name' => 'خزينة رئيسية أ',
            'balance' => 1000.00,
            'is_main' => true,
        ]);

        $this->ownerB = User::create([
            'name' => 'مالك المتجر ب',
            'phone' => '01022222222',
            'password' => bcrypt('password123'),
            'role' => 'OWNER',
            'is_admin' => false,
            'status' => 'ACTIVE',
        ]);
        Subscription::create([
            'user_id' => $this->ownerB->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->branchB = Branch::create([
            'user_id' => $this->ownerB->id,
            'name' => 'فرع ب',
            'code' => 'BR-B',
            'type' => BranchType::STORE,
            'is_main' => true,
            'is_active' => true,
        ]);
    }

    /**
     * C1: EnsureUserIsAdmin blocks hardcoded email if is_admin is false
     */
    public function test_c1_backdoor_email_is_strictly_blocked_without_is_admin(): void
    {
        $hacker = User::create([
            'name' => 'المخترق',
            'email' => 'ahmadhasandev711@gmail.com',
            'phone' => '01099999999',
            'password' => bcrypt('pass'),
            'is_admin' => false,
            'role' => 'OWNER',
        ]);

        $response = $this->actingAs($hacker)->getJson('/api/admin/stats');
        $response->assertStatus(403);
    }

    /**
     * C2: WooCommerce Webhook rejects missing signature
     */
    public function test_c2_woocommerce_webhook_rejects_missing_signature(): void
    {
        WooCommerceIntegration::create([
            'user_id' => $this->ownerA->id,
            'store_url' => 'https://mystore.com',
            'consumer_key' => 'ck_test',
            'consumer_secret' => 'cs_test',
            'webhook_secret' => 'super_secret_key',
            'is_active' => true,
        ]);

        $rawBody = json_encode(['id' => 101, 'status' => 'processing']);

        // 1. Missing signature header -> 401
        $res = $this->call(
            'POST',
            "/api/webhooks/woocommerce/{$this->ownerA->id}",
            [],
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            $rawBody
        );
        $res->assertStatus(401);

        // 2. Invalid signature -> 401
        $resInvalid = $this->call(
            'POST',
            "/api/webhooks/woocommerce/{$this->ownerA->id}",
            [],
            [],
            [],
            [
                'HTTP_X_WC_WEBHOOK_SIGNATURE' => 'invalid_signature',
                'CONTENT_TYPE' => 'application/json',
            ],
            $rawBody
        );
        $resInvalid->assertStatus(401);
    }

    /**
     * C4: Deleting a paid invoice reverses treasury transaction
     */
    public function test_c4_deleting_paid_invoice_reverses_treasury_cash(): void
    {
        $product = Product::create([
            'user_id' => $this->ownerA->id,
            'name' => 'منتج تجريبي',
            'purchase_price' => 50,
            'sale_price' => 100,
            'quantity' => 10,
        ]);

        $customer = Party::create([
            'user_id' => $this->ownerA->id,
            'type' => PartyType::CUSTOMER->value,
            'name' => 'عميل نقدي',
        ]);

        $invoiceService = app(InvoiceService::class);

        // Create paid cash sale invoice of 200 EGP
        $invoice = $invoiceService->createInvoice($this->ownerA, [
            'type' => 'SALE',
            'party_id' => $customer->id,
            'branch_id' => $this->branchA->id,
            'treasury_id' => $this->treasuryA->id,
            'date' => now()->toDateString(),
            'payment_method' => PaymentMethod::CASH->value,
            'paid_amount' => 200.00,
            'items' => [
                [
                    'product_id' => $product->id,
                    'quantity' => 2,
                    'unit_price' => 100,
                ],
            ],
        ]);

        // Treasury balance must be 1000 + 200 = 1200
        $this->treasuryA->refresh();
        $this->assertEquals(1200.00, (float) $this->treasuryA->balance);

        // Now delete the invoice -> Treasury must be reversed by withdrawing the 200 EGP back to 1000!
        $invoiceService->deleteInvoice($this->ownerA, $invoice->id);

        $this->treasuryA->refresh();
        $this->assertEquals(1000.00, (float) $this->treasuryA->balance);

        // Check reversal treasury transaction exists
        $reversalTxn = TreasuryTransaction::where('user_id', $this->ownerA->id)
            ->where('source_type', 'REVERSAL')
            ->where('source_id', $invoice->id)
            ->first();
        $this->assertNotNull($reversalTxn);
        $this->assertEquals(TreasuryTransactionType::WITHDRAWAL, $reversalTxn->type);
        $this->assertEquals(200.00, (float) $reversalTxn->amount);
    }

    /**
     * C5: Stock transfer receive rejects excessive received quantity
     */
    public function test_c5_stock_transfer_rejects_excessive_received_quantity(): void
    {
        $product = Product::create([
            'user_id' => $this->ownerA->id,
            'name' => 'شاي أسود',
            'purchase_price' => 10,
            'sale_price' => 20,
            'quantity' => 50,
        ]);

        $branch2 = Branch::create([
            'user_id' => $this->ownerA->id,
            'name' => 'فرع أ2',
            'code' => 'BR-A2',
            'type' => BranchType::STORE,
        ]);

        $transfer = StockTransfer::create([
            'user_id' => $this->ownerA->id,
            'transfer_number' => 'TRF-TEST-99',
            'from_branch_id' => $this->branchA->id,
            'to_branch_id' => $branch2->id,
            'status' => StockTransferStatus::IN_TRANSIT,
            'created_by' => $this->ownerA->id,
            'transferred_at' => now(),
        ]);

        $item = StockTransferItem::create([
            'stock_transfer_id' => $transfer->id,
            'product_id' => $product->id,
            'quantity_sent' => 5,
        ]);

        $transferService = app(StockTransferService::class);

        // Attempting to receive 10 units when only 5 were sent must throw StockTransferDomainException
        $this->expectException(StockTransferDomainException::class);

        $transferService->receiveTransfer($this->ownerA, $transfer, [
            'items' => [
                $item->id => [
                    'quantity_received' => 10,
                ],
            ],
        ]);
    }

    /**
     * C6: StockService prevents negative stock
     */
    public function test_c6_stock_service_prevents_negative_stock(): void
    {
        $product = Product::create([
            'user_id' => $this->ownerA->id,
            'name' => 'سكر أبيض',
            'purchase_price' => 10,
            'sale_price' => 20,
            'quantity' => 3, // Only 3 units in stock
        ]);

        $stockService = app(StockService::class);

        // Selling 5 units when only 3 exist must throw PosDomainException
        $this->expectException(PosDomainException::class);

        $stockService->recordMovement(
            $this->ownerA,
            $product,
            'OUT',
            'SALE',
            1,
            5 // Requested 5
        );
    }

    /**
     * C8: InvoiceRequest rejects cross-tenant IDs (IDOR protection)
     */
    public function test_c8_invoice_request_rejects_cross_tenant_branch_and_party(): void
    {
        $partyB = Party::create([
            'user_id' => $this->ownerB->id,
            'name' => 'عميل المتجر ب',
            'type' => PartyType::CUSTOMER->value,
        ]);

        $productA = Product::create([
            'user_id' => $this->ownerA->id,
            'name' => 'منتج المتجر أ',
            'purchase_price' => 10,
            'sale_price' => 20,
            'quantity' => 50,
        ]);

        // Owner A tries to pass Party B (from Store B) in InvoiceRequest -> Validation Error 422!
        $response = $this->actingAs($this->ownerA)->postJson('/api/invoices', [
            'type' => 'SALE',
            'party_id' => $partyB->id, // Cross-tenant!
            'branch_id' => $this->branchA->id,
            'date' => now()->toDateString(),
            'items' => [
                [
                    'product_id' => $productA->id,
                    'quantity' => 1,
                    'unit_price' => 20,
                ],
            ],
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['party_id']);

        // Owner A tries to pass Branch B (from Store B) -> Validation Error 422!
        $responseBranch = $this->actingAs($this->ownerA)->postJson('/api/invoices', [
            'type' => 'SALE',
            'branch_id' => $this->branchB->id, // Cross-tenant!
            'date' => now()->toDateString(),
            'items' => [
                [
                    'product_id' => $productA->id,
                    'quantity' => 1,
                    'unit_price' => 20,
                ],
            ],
        ]);

        $responseBranch->assertStatus(422)
            ->assertJsonValidationErrors(['branch_id']);
    }
}
