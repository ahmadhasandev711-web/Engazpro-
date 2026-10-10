<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('party_id')->constrained()->cascadeOnDelete();
            $table->string('source_type'); // INVOICE, PAYMENT, ADJUSTMENT, INITIAL
            $table->unsignedBigInteger('source_id')->nullable();
            $table->date('date')->index();
            $table->string('description');
            $table->decimal('debit', 14, 2)->default(0.00);  // مدين (عليه)
            $table->decimal('credit', 14, 2)->default(0.00); // دائن (له)
            $table->decimal('balance_after', 14, 2);
            $table->timestamps();

            $table->index(['user_id', 'party_id']);
            $table->index(['party_id', 'date']);
            $table->index(['source_type', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_entries');
    }
};
