<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employee_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 32); // BONUS, DEDUCTION, ADVANCE
            $table->decimal('amount', 12, 2);
            $table->date('date');
            $table->string('reason', 255)->nullable();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->index(['user_id', 'employee_id', 'date']);
        });

        Schema::create('payroll_payouts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('employee_id')->constrained('users')->cascadeOnDelete();
            $table->string('month', 7); // YYYY-MM e.g. 2026-09
            $table->decimal('base_salary', 12, 2)->default(0.00);
            $table->decimal('commission_amount', 12, 2)->default(0.00);
            $table->decimal('total_bonuses', 12, 2)->default(0.00);
            $table->decimal('total_deductions', 12, 2)->default(0.00);
            $table->decimal('net_paid', 12, 2);
            $table->string('payment_method', 32)->default('CASH');
            $table->foreignId('treasury_id')->constrained('treasuries')->restrictOnDelete();
            $table->foreignId('expense_id')->nullable()->constrained('expenses')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->foreignId('paid_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('paid_at');
            $table->timestamps();

            $table->unique(['user_id', 'employee_id', 'month']);
            $table->index(['user_id', 'month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_payouts');
        Schema::dropIfExists('employee_adjustments');
    }
};
