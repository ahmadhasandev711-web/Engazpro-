<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add wc_product_id to products
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedBigInteger('wc_product_id')->nullable()->after('notes');
            $table->index(['user_id', 'wc_product_id']);
        });

        // 2. Add wc_variation_id to product_variants
        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedBigInteger('wc_variation_id')->nullable()->after('min_quantity');
            $table->index(['product_id', 'wc_variation_id']);
        });

        // 3. Add wc_customer_id & wc_email to parties
        Schema::table('parties', function (Blueprint $table) {
            $table->unsignedBigInteger('wc_customer_id')->nullable()->after('notes');
            $table->string('wc_email')->nullable()->after('wc_customer_id');
            $table->index(['user_id', 'wc_customer_id']);
            $table->index(['user_id', 'wc_email']);
        });

        // 4. Add wc_order_id & shipping_amount to invoices
        Schema::table('invoices', function (Blueprint $table) {
            $table->unsignedBigInteger('wc_order_id')->nullable()->after('idempotency_key');
            $table->decimal('shipping_amount', 12, 2)->default(0)->after('tax');
            $table->unique(['user_id', 'wc_order_id'], 'invoices_user_wc_order_unique');
        });

        // 5. Create woocommerce_integrations table
        Schema::create('woocommerce_integrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('store_url');
            $table->text('consumer_key');
            $table->text('consumer_secret');
            $table->text('webhook_secret')->nullable();
            $table->foreignId('online_branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->boolean('auto_sync_stock')->default(true);
            $table->boolean('is_active')->default(false);
            $table->timestamp('last_synced_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });

        // 6. Create wc_orders table
        Schema::create('wc_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('wc_order_id');
            $table->foreignId('party_id')->nullable()->constrained('parties')->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->foreignId('mandob_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('invoice_id')->nullable()->constrained('invoices')->nullOnDelete();
            $table->string('status')->default('PENDING_CONFIRMATION');
            $table->string('payment_status')->default('PENDING_COD');
            $table->string('wc_payment_method')->nullable();
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
            $table->json('wc_coupon_codes')->nullable();
            $table->json('items_snapshot')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'wc_order_id'], 'wc_orders_user_order_unique');
            $table->index(['user_id', 'status']);
            $table->index(['branch_id', 'status']);
            $table->index(['mandob_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wc_orders');
        Schema::dropIfExists('woocommerce_integrations');

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropUnique('invoices_user_wc_order_unique');
            $table->dropColumn(['wc_order_id', 'shipping_amount']);
        });

        Schema::table('parties', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'wc_customer_id']);
            $table->dropIndex(['user_id', 'wc_email']);
            $table->dropColumn(['wc_customer_id', 'wc_email']);
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropIndex(['product_id', 'wc_variation_id']);
            $table->dropColumn('wc_variation_id');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'wc_product_id']);
            $table->dropColumn('wc_product_id');
        });
    }
};
