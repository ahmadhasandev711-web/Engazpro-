<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('easyfy_coupons', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique();
            $table->string('discount_type', 24);
            $table->decimal('discount_value', 12, 2)->default(0);
            $table->decimal('min_order_amount', 12, 2)->default(0);
            $table->decimal('max_discount_amount', 12, 2)->nullable();
            $table->unsignedInteger('max_uses')->nullable();
            $table->unsignedInteger('max_uses_per_account')->nullable();
            $table->unsignedInteger('used_count')->default(0);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('easyfy_shipping_zones', function (Blueprint $table) {
            $table->id();
            $table->string('governorate_name');
            $table->decimal('shipping_fee', 12, 2)->default(0);
            $table->decimal('free_shipping_threshold', 12, 2)->nullable();
            $table->string('estimated_days', 64)->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('easyfy_store_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->text('value')->nullable();
            $table->timestamps();
        });

        Schema::create('easyfy_store_addresses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained('users')->cascadeOnDelete();
            $table->string('label');
            $table->string('recipient_name');
            $table->string('recipient_phone', 40);
            $table->foreignId('shipping_zone_id')->nullable()->constrained('easyfy_shipping_zones')->nullOnDelete();
            $table->string('governorate');
            $table->text('address_line');
            $table->text('notes')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->index(['account_id', 'is_default'], 'idx_easyfy_addr_acc_def');
        });

        Schema::create('easyfy_carts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('coupon_code', 64)->nullable();
            $table->timestamps();

            $table->unique(['account_id', 'user_id'], 'uq_easyfy_cart_acc_user');
        });

        Schema::create('easyfy_cart_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('cart_id')->constrained('easyfy_carts')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained('easyfy_products')->cascadeOnDelete();
            $table->foreignId('variant_id')->constrained('easyfy_product_variants')->cascadeOnDelete();
            $table->unsignedInteger('quantity');
            $table->text('custom_note')->nullable();
            $table->string('artwork_path')->nullable();
            $table->timestamps();
        });

        Schema::create('easyfy_orders', function (Blueprint $table) {
            $table->id();
            $table->string('order_number', 32)->unique();
            $table->string('idempotency_key', 100)->nullable();
            $table->foreignId('account_id')->constrained('users')->cascadeOnDelete();
            $table->string('store_code', 64)->nullable();
            $table->string('store_name')->nullable();
            $table->string('owner_name')->nullable();
            $table->string('owner_phone', 40)->nullable();
            $table->foreignId('ordered_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('ordered_by_name')->nullable();
            $table->string('ordered_by_phone', 40)->nullable();
            $table->string('ordered_by_role', 32)->nullable();
            $table->foreignId('shipping_zone_id')->nullable()->constrained('easyfy_shipping_zones')->nullOnDelete();
            $table->string('recipient_name');
            $table->string('recipient_phone', 40);
            $table->string('governorate');
            $table->text('shipping_address');
            $table->text('customer_notes')->nullable();
            $table->string('courier_name')->nullable();
            $table->string('tracking_number')->nullable();
            $table->decimal('subtotal', 12, 2);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->foreignId('coupon_id')->nullable()->constrained('easyfy_coupons')->nullOnDelete();
            $table->string('coupon_code', 64)->nullable();
            $table->decimal('shipping_fee', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2);
            $table->decimal('total_cost', 12, 2)->default(0);
            $table->decimal('gross_profit', 12, 2)->default(0);
            $table->string('payment_method', 32);
            $table->string('payment_verification_status', 32);
            $table->string('transfer_reference', 120)->nullable();
            $table->string('payment_proof_path')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->text('payment_rejection_reason')->nullable();
            $table->string('status', 32);
            $table->text('admin_notes')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();

            $table->unique(['account_id', 'idempotency_key'], 'uq_easyfy_ord_acc_idemp');
            $table->index(['account_id', 'created_at'], 'idx_easyfy_ord_acc_created');
            $table->index(['status', 'created_at'], 'idx_easyfy_ord_status_created');
            $table->index(['payment_verification_status', 'created_at'], 'idx_easyfy_ord_pay_created');
        });

        Schema::create('easyfy_order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('easyfy_orders')->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('easyfy_products')->nullOnDelete();
            $table->foreignId('variant_id')->nullable()->constrained('easyfy_product_variants')->nullOnDelete();
            $table->string('product_name');
            $table->string('variant_label');
            $table->string('sku')->nullable();
            $table->string('stock_mode', 24);
            $table->decimal('unit_price', 12, 2);
            $table->decimal('unit_cost', 12, 2)->default(0);
            $table->unsignedInteger('quantity');
            $table->decimal('line_total', 12, 2);
            $table->decimal('line_cost', 12, 2)->default(0);
            $table->decimal('line_profit', 12, 2)->default(0);
            $table->text('custom_note')->nullable();
            $table->string('artwork_path')->nullable();
            $table->timestamps();
        });

        Schema::create('easyfy_order_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('easyfy_orders')->cascadeOnDelete();
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32);
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_name')->nullable();
            $table->text('note')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('easyfy_stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('variant_id')->constrained('easyfy_product_variants')->cascadeOnDelete();
            $table->string('type', 32);
            $table->integer('quantity_delta');
            $table->integer('balance_after');
            $table->decimal('unit_cost', 12, 2)->nullable();
            $table->foreignId('reference_order_id')->nullable()->constrained('easyfy_orders')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['variant_id', 'created_at'], 'idx_easyfy_stk_var_created');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('easyfy_stock_movements');
        Schema::dropIfExists('easyfy_order_status_histories');
        Schema::dropIfExists('easyfy_order_items');
        Schema::dropIfExists('easyfy_orders');
        Schema::dropIfExists('easyfy_cart_items');
        Schema::dropIfExists('easyfy_carts');
        Schema::dropIfExists('easyfy_store_addresses');
        Schema::dropIfExists('easyfy_store_settings');
        Schema::dropIfExists('easyfy_shipping_zones');
        Schema::dropIfExists('easyfy_coupons');
    }
};
