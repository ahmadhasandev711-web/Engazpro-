<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->string('idempotency_key', 100)->nullable()->after('invoice_number');
            $table->unique(['user_id', 'idempotency_key']);
            $table->index(['user_id', 'created_by']);
            $table->index(['user_id', 'party_id']);
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->string('idempotency_key', 100)->nullable()->after('id');
            $table->unique(['user_id', 'idempotency_key']);
            $table->index(['user_id', 'created_by']);
        });

        Schema::table('parties', function (Blueprint $table) {
            $table->index(['user_id', 'phone']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('parties', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'phone']);
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'idempotency_key']);
            $table->dropIndex(['user_id', 'created_by']);
            $table->dropColumn('idempotency_key');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'idempotency_key']);
            $table->dropIndex(['user_id', 'created_by']);
            $table->dropIndex(['user_id', 'party_id']);
            $table->dropColumn('idempotency_key');
        });
    }
};