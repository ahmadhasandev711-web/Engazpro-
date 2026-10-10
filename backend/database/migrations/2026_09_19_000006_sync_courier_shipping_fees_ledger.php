<?php

use App\Models\Invoice;
use App\Models\LedgerEntry;
use App\Models\Party;
use App\Models\User;
use App\Services\LedgerService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Accrues courier shipping fees as credit entries in the courier's ledger
     * and recalculates balances to ensure zero-leak exact reconciliation.
     */
    public function up(): void
    {
        $ledgerService = app(LedgerService::class);

        DB::transaction(function () use ($ledgerService) {
            $invoices = Invoice::whereNotNull('courier_party_id')
                ->where('shipping_amount', '>', 0)
                ->get();

            $affectedCouriers = [];

            foreach ($invoices as $inv) {
                $courier = Party::find($inv->courier_party_id);
                if (!$courier) {
                    continue;
                }

                $user = User::find($inv->user_id) ?? User::first();
                if (!$user) {
                    continue;
                }

                // Check if shipping fee credit is already recorded
                $alreadyExists = LedgerEntry::where('party_id', $courier->id)
                    ->where('source_type', 'INVOICE')
                    ->where('source_id', $inv->id)
                    ->where('credit', '>', 0)
                    ->exists();

                if (!$alreadyExists) {
                    $ledgerService->recordEntry(
                        $user,
                        $courier,
                        'INVOICE',
                        $inv->id,
                        $inv->date->format('Y-m-d'),
                        "استحقاق أتعاب شحن وتوصيل - فاتورة {$inv->invoice_number}",
                        0.0,
                        (float) $inv->shipping_amount
                    );
                }

                $affectedCouriers[$courier->id] = $courier;
            }

            foreach ($affectedCouriers as $courier) {
                $ledgerService->auditAndRecalculateBalance($courier);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reversal not needed
    }
};
