<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('treasury_transactions')) {
            return;
        }

        foreach (['target_balance_before', 'target_balance_after'] as $column) {
            if (Schema::hasColumn('treasury_transactions', $column)) {
                Schema::table('treasury_transactions', fn ($table) => $table->dropColumn($column));
            }
        }
    }

    public function down(): void
    {
        // Removed destination snapshots cannot be reconstructed.
    }
};
