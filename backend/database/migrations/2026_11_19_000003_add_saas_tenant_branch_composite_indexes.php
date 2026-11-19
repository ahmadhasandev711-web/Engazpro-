<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->index(['user_id', 'branch_id', 'type', 'date'], 'invoices_tenant_branch_type_date_idx');
            $table->index(['user_id', 'parent_invoice_id'], 'invoices_tenant_parent_idx');
            $table->index(['user_id', 'salesperson_id', 'type', 'date'], 'invoices_tenant_salesperson_type_date_idx');
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->index(['user_id', 'treasury_id', 'date'], 'expenses_tenant_treasury_date_idx');
            $table->index(['user_id', 'shift_id'], 'expenses_tenant_shift_idx');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->index(['user_id', 'treasury_id', 'type', 'date'], 'payments_tenant_treasury_type_date_idx');
            $table->index(['user_id', 'shift_id', 'type'], 'payments_tenant_shift_type_idx');
        });

        Schema::table('shifts', function (Blueprint $table) {
            $table->index(['user_id', 'created_by', 'status'], 'shifts_tenant_creator_status_idx');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->index(['owner_id', 'branch_id', 'role'], 'users_tenant_branch_role_idx');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex('invoices_tenant_branch_type_date_idx');
            $table->dropIndex('invoices_tenant_parent_idx');
            $table->dropIndex('invoices_tenant_salesperson_type_date_idx');
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->dropIndex('expenses_tenant_treasury_date_idx');
            $table->dropIndex('expenses_tenant_shift_idx');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('payments_tenant_treasury_type_date_idx');
            $table->dropIndex('payments_tenant_shift_type_idx');
        });

        Schema::table('shifts', function (Blueprint $table) {
            $table->dropIndex('shifts_tenant_creator_status_idx');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_tenant_branch_role_idx');
        });
    }
};
