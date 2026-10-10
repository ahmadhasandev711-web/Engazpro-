<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('invoice_number')->index();
            $table->string('type'); // SALE, PURCHASE, SALE_RETURN, PURCHASE_RETURN
            $table->foreignId('party_id')->nullable()->constrained('parties')->nullOnDelete();
            $table->foreignId('parent_invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->date('date')->index();
            $table->decimal('subtotal', 14, 2)->default(0.00);
            $table->decimal('discount', 14, 2)->default(0.00);
            $table->decimal('tax', 14, 2)->default(0.00);
            $table->decimal('total', 14, 2)->default(0.00);
            $table->decimal('paid_amount', 14, 2)->default(0.00);
            $table->decimal('remaining_amount', 14, 2)->default(0.00);
            $table->string('payment_method')->default('CASH'); // CASH, CARD, TRANSFER, CREDIT
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'type']);
            $table->index(['user_id', 'date']);
        });

        Schema::create('invoice_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('invoice_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->string('product_name');
            $table->string('product_code')->nullable();
            $table->decimal('quantity', 12, 2);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('purchase_price_at_sale', 12, 2)->nullable();
            $table->decimal('total', 14, 2);
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_items');
        Schema::dropIfExists('invoices');
    }
};
