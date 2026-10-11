<?php

use App\Models\Invoice;
use App\Models\LedgerEntry;
use App\Models\Party;
use App\Models\WcOrder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::transaction(function () {
            // Group duplicate 'عميل أونلاين' parties by user_id
            $userIds = Party::where('type', 'CUSTOMER')
                ->where('name', 'عميل أونلاين')
                ->distinct()
                ->pluck('user_id');

            foreach ($userIds as $userId) {
                $parties = Party::where('user_id', $userId)
                    ->where('type', 'CUSTOMER')
                    ->where('name', 'عميل أونلاين')
                    ->orderBy('id', 'asc')
                    ->get();

                if ($parties->count() > 1) {
                    $canonical = $parties->first();
                    $duplicates = $parties->slice(1);
                    $duplicateIds = $duplicates->pluck('id')->all();

                    // Re-link invoices to canonical party
                    Invoice::whereIn('party_id', $duplicateIds)->update(['party_id' => $canonical->id]);

                    // Re-link WooCommerce orders to canonical party
                    WcOrder::whereIn('party_id', $duplicateIds)->update(['party_id' => $canonical->id]);

                    // Re-link ledger entries to canonical party
                    LedgerEntry::whereIn('party_id', $duplicateIds)->update(['party_id' => $canonical->id]);

                    // Delete duplicate party rows
                    Party::whereIn('id', $duplicateIds)->delete();
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Irreversible data deduplication
    }
};
