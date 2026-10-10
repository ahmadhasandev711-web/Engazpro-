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
        Schema::create('treasuries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('type', 30)->default('MAIN');
            $table->decimal('balance', 12, 2)->default(0.00);
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('shifts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('treasury_id')->constrained('treasuries')->cascadeOnDelete();
            $table->string('shift_number', 50);
            $table->string('status', 30)->default('OPEN');
            $table->timestamp('opened_at');
            $table->timestamp('closed_at')->nullable();
            $table->timestamp('settled_at')->nullable();
            $table->foreignId('settled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('opening_balance', 12, 2)->default(0.00);
            $table->decimal('cash_sales', 12, 2)->default(0.00);
            $table->decimal('electronic_sales', 12, 2)->default(0.00);
            $table->decimal('credit_sales', 12, 2)->default(0.00);
            $table->decimal('cash_receipts', 12, 2)->default(0.00);
            $table->decimal('cash_returns', 12, 2)->default(0.00);
            $table->decimal('expenses', 12, 2)->default(0.00);
            $table->decimal('expected_cash', 12, 2)->default(0.00);
            $table->decimal('actual_cash', 12, 2)->nullable();
            $table->decimal('difference', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->text('settlement_notes')->nullable();
            $table->timestamps();
        });

        Schema::create('treasury_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->foreignId('treasury_id')->constrained('treasuries')->cascadeOnDelete();
            $table->foreignId('target_treasury_id')->nullable()->constrained('treasuries')->nullOnDelete();
            $table->foreignId('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->string('type', 30);
            $table->decimal('amount', 12, 2);
            $table->decimal('balance_before', 12, 2)->default(0.00);
            $table->decimal('balance_after', 12, 2)->default(0.00);
            $table->string('source_type', 50)->default('MANUAL');
            $table->unsignedBigInteger('source_id')->nullable();
            $table->date('date');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('treasury_id')->nullable()->after('created_by')->constrained('treasuries')->nullOnDelete();
            $table->foreignId('shift_id')->nullable()->after('treasury_id')->constrained('shifts')->nullOnDelete();
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('treasury_id')->nullable()->after('created_by')->constrained('treasuries')->nullOnDelete();
            $table->foreignId('shift_id')->nullable()->after('treasury_id')->constrained('shifts')->nullOnDelete();
        });

        Schema::table('expenses', function (Blueprint $table) {
            $table->foreignId('treasury_id')->nullable()->after('created_by')->constrained('treasuries')->nullOnDelete();
            $table->foreignId('shift_id')->nullable()->after('treasury_id')->constrained('shifts')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('expenses', function (Blueprint $table) {
            $table->dropForeign(['treasury_id']);
            $table->dropForeign(['shift_id']);
            $table->dropColumn(['treasury_id', 'shift_id']);
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->dropForeign(['treasury_id']);
            $table->dropForeign(['shift_id']);
            $table->dropColumn(['treasury_id', 'shift_id']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign(['treasury_id']);
            $table->dropForeign(['shift_id']);
            $table->dropColumn(['treasury_id', 'shift_id']);
        });

        Schema::dropIfExists('treasury_transactions');
        Schema::dropIfExists('shifts');
        Schema::dropIfExists('treasuries');
    }
};
