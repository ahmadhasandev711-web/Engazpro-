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
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('owner_id')->nullable()->after('id')->constrained('users')->cascadeOnDelete();
            $table->string('role', 30)->default('OWNER')->after('password');
            $table->string('status', 30)->default('ACTIVE')->after('role');
            $table->json('permissions')->nullable()->after('status');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('user_id')->constrained('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn('created_by');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn('created_by');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['owner_id']);
            $table->dropColumn(['owner_id', 'role', 'status', 'permissions']);
        });
    }
};
