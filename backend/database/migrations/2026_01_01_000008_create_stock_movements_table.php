<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // IN, OUT
            $table->string('source_type'); // PURCHASE, SALE, PURCHASE_RETURN, SALE_RETURN, ADJUSTMENT, INITIAL
            $table->unsignedBigInteger('source_id')->nullable();
            $table->decimal('quantity', 12, 2);
            $table->decimal('balance_after', 12, 2);
            $table->decimal('unit_price', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'product_id']);
            $table->index(['source_type', 'source_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
