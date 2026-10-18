<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('invoices')
            ->whereNotIn('type', ['SALE', 'SALE_RETURN'])
            ->whereNotNull('salesperson_id')
            ->update(['salesperson_id' => null]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Irreversible data sanitation: non-sale invoices do not have salespersons.
    }
};
