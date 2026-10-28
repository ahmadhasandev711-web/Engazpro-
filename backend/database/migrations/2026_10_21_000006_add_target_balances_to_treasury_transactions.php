<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('treasury_transactions', function (Blueprint $table) {
            $table->decimal('target_balance_before', 12, 2)->nullable()->after('balance_after');
            $table->decimal('target_balance_after', 12, 2)->nullable()->after('target_balance_before');
        });
    }

    public function down(): void
    {
        Schema::table('treasury_transactions', function (Blueprint $table) {
            $table->dropColumn(['target_balance_before', 'target_balance_after']);
        });
    }
};
