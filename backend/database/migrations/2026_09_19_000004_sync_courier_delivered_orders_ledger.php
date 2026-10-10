<?php

use App\Enums\PartyType;
use App\Enums\WcOrderStatus;
use App\Models\Invoice;
use App\Models\LedgerEntry;
use App\Models\Party;
use App\Models\User;
use App\Models\WcOrder;
use App\Services\LedgerService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $ledgerService = app(LedgerService::class);

        $courierOrders = WcOrder::whereNotNull('courier_party_id')
            ->where('status', WcOrderStatus::DELIVERED)
            ->whereNotNull('invoice_id')
            ->get();

        $affectedParties = collect();

        foreach ($courierOrders as $order) {
            $invoice = Invoice::find($order->invoice_id);
            if (!$invoice) {
                continue;
            }

            $courier = Party::find($order->courier_party_id);
            if (!$courier || $courier->type !== PartyType::COURIER->value) {
                continue;
            }

            $exists = LedgerEntry::where('party_id', $courier->id)
                ->where('source_type', 'INVOICE')
                ->where('source_id', $invoice->id)
                ->exists();

            if (!$exists) {
                $user = User::find($order->user_id) ?? User::first();
                if ($user) {
                    $desc = "تحصيل شحنة أوردر #{$order->wc_order_id} - العميل: " . ($order->customer_name ?: 'عميل ووكومرس');
                    $ledgerService->recordEntry(
                        user: $user,
                        party: $courier,
                        sourceType: 'INVOICE',
                        sourceId: $invoice->id,
                        date: $invoice->date->format('Y-m-d'),
                        description: $desc,
                        debit: (float) $invoice->total,
                        credit: 0.0
                    );
                }
            }

            $affectedParties->push($courier->id);
        }

        // إعادة ضبط وتدقيق رصيد كل شركة شحن تأثرت
        foreach ($affectedParties->unique() as $partyId) {
            $party = Party::find($partyId);
            if ($party) {
                $ledgerService->auditAndRecalculateBalance($party);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No down migration needed for retroactive ledger entries
    }
};
