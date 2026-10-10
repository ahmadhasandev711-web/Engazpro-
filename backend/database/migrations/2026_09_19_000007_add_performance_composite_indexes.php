<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Adds high-performance composite indexes for financial queries, shifts, and categories.
     */
    public function up(): void
    {
        Schema::table('treasury_transactions', function (Blueprint $table) {
            $table->index(['treasury_id', 'date'], 'treasury_trans_treasury_date_idx');
            $table->index(['user_id', 'date'], 'treasury_trans_user_date_idx');
        });

        Schema::table('shifts', function (Blueprint $table) {
            $table->index(['user_id', 'status'], 'shifts_user_status_idx');
            $table->index(['treasury_id', 'status'], 'shifts_treasury_status_idx');
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->index(['user_id', 'name'], 'categories_user_name_idx');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->dropIndex('categories_user_name_idx');
        });

        Schema::table('shifts', function (Blueprint $table) {
            $table->dropIndex('shifts_user_status_idx');
            $table->dropIndex('shifts_treasury_status_idx');
        });

        Schema::table('treasury_transactions', function (Blueprint $table) {
            $table->dropIndex('treasury_trans_treasury_date_idx');
            $table->dropIndex('treasury_trans_user_date_idx');
        });
    }
};
