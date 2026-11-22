<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('easyfy_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('image_path')->nullable();
            $table->integer('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('easyfy_products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->nullable()->constrained('easyfy_categories')->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('short_description')->nullable();
            $table->text('description')->nullable();
            $table->string('stock_mode', 24)->index('idx_easyfy_prod_stock_mode');
            $table->unsignedSmallInteger('lead_time_days')->nullable();
            $table->unsignedInteger('min_order_qty')->default(1);
            $table->boolean('allow_custom_note')->default(false);
            $table->string('custom_note_label')->nullable();
            $table->boolean('allow_artwork_upload')->default(false);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_featured')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['is_active', 'sort_order'], 'idx_easyfy_prod_active_sort');
            $table->index(['category_id', 'is_active'], 'idx_easyfy_prod_cat_active');
        });

        Schema::create('easyfy_product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('easyfy_products')->cascadeOnDelete();
            $table->string('sku')->unique();
            $table->string('label');
            $table->json('attributes')->nullable();
            $table->decimal('cost_price', 12, 2)->default(0);
            $table->decimal('selling_price', 12, 2);
            $table->decimal('compare_at_price', 12, 2)->nullable();
            $table->integer('stock_quantity')->default(0);
            $table->integer('low_stock_threshold')->default(5);
            $table->unsignedInteger('min_order_qty')->default(1);
            $table->boolean('is_active')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index(['product_id', 'is_active'], 'idx_easyfy_var_prod_active');
        });

        Schema::create('easyfy_product_images', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('easyfy_products')->cascadeOnDelete();
            $table->foreignId('variant_id')->nullable()->constrained('easyfy_product_variants')->nullOnDelete();
            $table->string('image_path');
            $table->boolean('is_primary')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('easyfy_variant_price_tiers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('variant_id')->constrained('easyfy_product_variants')->cascadeOnDelete();
            $table->unsignedInteger('min_qty');
            $table->decimal('unit_price', 12, 2);
            $table->timestamps();

            $table->unique(['variant_id', 'min_qty'], 'uq_easyfy_tier_var_qty');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('easyfy_variant_price_tiers');
        Schema::dropIfExists('easyfy_product_images');
        Schema::dropIfExists('easyfy_product_variants');
        Schema::dropIfExists('easyfy_products');
        Schema::dropIfExists('easyfy_categories');
    }
};
