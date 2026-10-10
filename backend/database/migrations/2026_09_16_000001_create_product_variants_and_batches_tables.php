<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Add variant and expiry metadata to products table
        Schema::table('products', function (Blueprint $table) {
            $table->string('type')->default('STANDARD')->after('category_id');
            $table->boolean('has_expiry')->default(false)->after('type');
            $table->boolean('has_variants')->default(false)->after('has_expiry');
            $table->string('sub_unit')->nullable()->after('unit');
            $table->decimal('sub_unit_factor', 10, 2)->nullable()->after('sub_unit');
            $table->decimal('sub_unit_price', 10, 2)->nullable()->after('sub_unit_factor');
        });

        // 2. Create product_variants table
        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('color')->nullable();
            $table->string('size')->nullable();
            $table->string('barcode')->nullable()->index();
            $table->string('code')->nullable();
            $table->decimal('purchase_price', 10, 2)->nullable();
            $table->decimal('sale_price', 10, 2)->nullable();
            $table->decimal('quantity', 10, 2)->default(0);
            $table->decimal('min_quantity', 10, 2)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['product_id', 'barcode']);
            $table->index(['user_id', 'barcode']);
        });

        // 3. Create product_batches table
        Schema::create('product_batches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->foreignId('product_variant_id')->nullable()->constrained('product_variants')->nullOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('batch_number');
            $table->date('expiry_date')->index();
            $table->date('production_date')->nullable();
            $table->decimal('quantity', 10, 2)->default(0);
            $table->decimal('purchase_price', 10, 2)->nullable();
            $table->decimal('sale_price', 10, 2)->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['product_id', 'expiry_date']);
            $table->index(['user_id', 'expiry_date']);
        });

        // 4. Add variant and batch columns to invoice_items
        Schema::table('invoice_items', function (Blueprint $table) {
            $table->foreignId('product_variant_id')->nullable()->after('product_id')->constrained('product_variants')->nullOnDelete();
            $table->foreignId('product_batch_id')->nullable()->after('product_variant_id')->constrained('product_batches')->nullOnDelete();
            $table->string('variant_name')->nullable()->after('product_code');
            $table->string('batch_number')->nullable()->after('variant_name');
            $table->date('expiry_date')->nullable()->after('batch_number');
            $table->string('unit_name')->nullable()->after('expiry_date');
        });

        // 5. Add variant and batch columns to stock_movements
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->foreignId('product_variant_id')->nullable()->after('product_id')->constrained('product_variants')->nullOnDelete();
            $table->foreignId('product_batch_id')->nullable()->after('product_variant_id')->constrained('product_batches')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropForeign(['product_variant_id']);
            $table->dropForeign(['product_batch_id']);
            $table->dropColumn(['product_variant_id', 'product_batch_id']);
        });

        Schema::table('invoice_items', function (Blueprint $table) {
            $table->dropForeign(['product_variant_id']);
            $table->dropForeign(['product_batch_id']);
            $table->dropColumn([
                'product_variant_id',
                'product_batch_id',
                'variant_name',
                'batch_number',
                'expiry_date',
                'unit_name',
            ]);
        });

        Schema::dropIfExists('product_batches');
        Schema::dropIfExists('product_variants');

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'type',
                'has_expiry',
                'has_variants',
                'sub_unit',
                'sub_unit_factor',
                'sub_unit_price',
            ]);
        });
    }
};
