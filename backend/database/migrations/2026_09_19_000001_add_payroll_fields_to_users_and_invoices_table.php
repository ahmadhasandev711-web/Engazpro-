<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->decimal('base_salary', 12, 2)->default(0.00)->after('branch_id');
            $table->string('commission_type', 32)->default('NONE')->after('base_salary');
            $table->decimal('commission_rate', 8, 2)->default(0.00)->after('commission_type');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('salesperson_id')->nullable()->after('created_by')->constrained('users')->nullOnDelete();
            $table->index(['user_id', 'salesperson_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign(['salesperson_id']);
            $table->dropIndex(['user_id', 'salesperson_id', 'date']);
            $table->dropColumn('salesperson_id');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['base_salary', 'commission_type', 'commission_rate']);
        });
    }
};
