<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('name');
            $table->string('code', 64)->nullable();
            $table->string('type', 32);
            $table->string('discount_type', 32);
            $table->decimal('discount_value', 15, 2)->default(0);
            $table->unsignedInteger('buy_quantity')->nullable();
            $table->unsignedInteger('get_quantity')->nullable();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();
            $table->foreignId('product_id')->nullable()->constrained('products')->nullOnDelete();
            $table->decimal('min_order_amount', 15, 2)->default(0);
            $table->decimal('max_discount_amount', 15, 2)->nullable();
            $table->unsignedInteger('max_uses')->nullable();
            $table->unsignedInteger('used_count')->default(0);
            $table->date('starts_at')->nullable();
            $table->date('ends_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'is_active', 'type'], 'promotions_tenant_active_type_idx');
            $table->index(['user_id', 'code'], 'promotions_tenant_code_idx');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('promotion_id')->nullable()->after('parent_invoice_id')->constrained('promotions')->nullOnDelete();
            $table->string('coupon_code', 64)->nullable()->after('promotion_id');
            $table->decimal('promotion_discount', 15, 2)->default(0)->after('discount');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('promotion_id');
            $table->dropColumn(['coupon_code', 'promotion_discount']);
        });

        Schema::dropIfExists('promotions');
    }
};
