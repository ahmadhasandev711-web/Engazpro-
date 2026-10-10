<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('category_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code')->nullable();
            $table->string('barcode')->nullable()->index();
            $table->string('name')->index();
            $table->string('unit')->nullable();
            $table->decimal('purchase_price', 12, 2)->default(0.00);
            $table->decimal('sale_price', 12, 2)->default(0.00);
            $table->decimal('min_sale_price', 12, 2)->nullable();
            $table->decimal('quantity', 12, 2)->default(0.00);
            $table->decimal('min_quantity', 12, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'name']);
            $table->index(['user_id', 'barcode']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
