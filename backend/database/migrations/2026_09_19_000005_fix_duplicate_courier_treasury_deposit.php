<?php

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Treasury;
use App\Models\TreasuryTransaction;
use App\Support\Money;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Fixes duplicate cash treasury deposits for courier COD invoices.
     */
    public function up(): void
    {
        DB::transaction(function () {
            // Find courier invoices that erroneously deposited CASH at delivery
            $courierInvoices = Invoice::whereNotNull('courier_party_id')
                ->where('payment_method', 'CASH')
                ->get();

            foreach ($courierInvoices as $invoice) {
                // 1. Update invoice payment_method to COURIER_COD
                $invoice->update(['payment_method' => 'COURIER_COD']);

                // 2. Update payment records linked to this invoice
                Payment::where('invoice_id', $invoice->id)
                    ->where('method', 'CASH')
                    ->update(['method' => 'COURIER_COD']);

                // 3. Find duplicate treasury transaction created at delivery
                $transactions = TreasuryTransaction::where('source_type', 'INVOICE')
                    ->where('source_id', $invoice->id)
                    ->where('type', 'DEPOSIT')
                    ->get();

                foreach ($transactions as $tx) {
                    $treasury = Treasury::find($tx->treasury_id);
                    if ($treasury) {
                        $newBalance = Money::of($treasury->balance)
                            ->subtract(Money::of($tx->amount))
                            ->getAmount();
                        $treasury->update(['balance' => max(0, $newBalance)]);
                    }
                    $tx->delete();
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reversal not required as this cleans duplicate accounting entries
    }
};
