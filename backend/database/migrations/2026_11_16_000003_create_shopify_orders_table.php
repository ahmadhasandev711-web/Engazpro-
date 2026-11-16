<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shopify_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('shopify_order_id');
            $table->string('shopify_order_number')->nullable();
            $table->unsignedBigInteger('shopify_location_id')->nullable();
            $table->unsignedBigInteger('fulfillment_order_id')->nullable();
            $table->timestamp('order_date')->nullable();
            $table->foreignId('party_id')->nullable()->constrained('parties')->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('mandob_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('shipping_type')->nullable();
            $table->foreignId('courier_party_id')->nullable()->constrained('parties')->nullOnDelete();
            $table->string('courier_name')->nullable();
            $table->string('tracking_number')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->string('status')->default('PENDING_CONFIRMATION');
            $table->timestamp('call_confirmed_at')->nullable();
            $table->foreignId('call_confirmed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('payment_status')->default('PENDING_COD');
            $table->string('shopify_payment_gateway')->nullable();
            $table->decimal('shipping_cost', 12, 2)->default(0);
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('discount_total', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->string('customer_email')->nullable();
            $table->text('customer_address')->nullable();
            $table->string('governorate')->nullable();
            $table->string('city')->nullable();
            $table->text('notes')->nullable();
            $table->json('coupon_codes')->nullable();
            $table->json('discount_breakdown')->nullable();
            $table->json('items_snapshot')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'shopify_order_id'], 'shopify_orders_user_order_unique');
            $table->index(['user_id', 'status']);
            $table->index(['branch_id', 'status']);
            $table->index(['mandob_id', 'status']);
            $table->index(['courier_party_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shopify_orders');
    }
};
