<?php

namespace Tests\Feature;

use App\Enums\DocumentType;
use App\Exceptions\PosDomainException;
use App\Models\Branch;
use App\Models\DocumentSequence;
use App\Models\Party;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use App\Services\DocumentSequenceService;
use App\Services\InvoiceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class Wave2FollowupsTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected Branch $branch;
    protected Product $product;
    protected Party $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['role' => 'OWNER']);
        Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $this->branch = Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'BR-01',
            'is_main' => true,
            'is_active' => true,
        ]);

        $this->product = Product::create([
            'user_id' => $this->owner->id,
            'name' => 'صنف تجريبي',
            'purchase_price' => 50,
            'sale_price' => 100,
            'quantity' => 10,
        ]);

        $this->customer = Party::create([
            'user_id' => $this->owner->id,
            'type' => 'CUSTOMER',
            'name' => 'عميل تجريبي',
        ]);
    }

    public function test_invalid_invoice_type_throws_pos_domain_exception(): void
    {
        $invoiceService = app(InvoiceService::class);

        try {
            $invoiceService->createInvoice($this->owner, [
                'type' => 'UNSUPPORTED_TYPE',
                'party_id' => $this->customer->id,
                'branch_id' => $this->branch->id,
                'items' => [
                    [
                        'product_id' => $this->product->id,
                        'quantity' => 1,
                        'unit_price' => 100,
                    ],
                ],
            ]);
            $this->fail('Expected PosDomainException was not thrown');
        } catch (PosDomainException $e) {
            $this->assertEquals('INVALID_INVOICE_TYPE', $e->getErrorCode());
            $this->assertStringContainsString('غير صالح', $e->getMessage());
        }
    }

    public function test_document_sequence_next_generates_atomic_consecutive_numbers(): void
    {
        $seqService = app(DocumentSequenceService::class);

        // Ensure no sequence exists yet
        DocumentSequence::where('user_id', $this->owner->id)->delete();

        $first = $seqService->next($this->owner->id, DocumentType::SALE);
        $second = $seqService->next($this->owner->id, DocumentType::SALE);
        $third = $seqService->next($this->owner->id, DocumentType::SALE);

        $this->assertEquals(1, $first);
        $this->assertEquals(2, $second);
        $this->assertEquals(3, $third);

        $this->assertDatabaseHas('document_sequences', [
            'user_id' => $this->owner->id,
            'type' => DocumentType::SALE->value,
            'last_number' => 3,
        ]);
    }
}
