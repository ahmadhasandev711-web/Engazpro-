<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->unsignedBigInteger('shopify_product_id')->nullable()->after('wc_product_id');
            $table->unsignedBigInteger('shopify_variant_id')->nullable()->after('shopify_product_id');
            $table->unsignedBigInteger('shopify_inventory_item_id')->nullable()->after('shopify_variant_id');
            $table->index(['user_id', 'shopify_product_id']);
            $table->index(['user_id', 'shopify_inventory_item_id']);
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->unsignedBigInteger('shopify_variant_id')->nullable()->after('wc_variation_id');
            $table->unsignedBigInteger('shopify_inventory_item_id')->nullable()->after('shopify_variant_id');
            $table->index(['product_id', 'shopify_variant_id']);
            $table->index(['user_id', 'shopify_inventory_item_id']);
        });

        Schema::table('parties', function (Blueprint $table) {
            $table->unsignedBigInteger('shopify_customer_id')->nullable()->after('wc_email');
            $table->index(['user_id', 'shopify_customer_id']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->unsignedBigInteger('shopify_order_id')->nullable()->after('wc_order_id');
            $table->unique(['user_id', 'shopify_order_id'], 'invoices_user_shopify_order_unique');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropUnique('invoices_user_shopify_order_unique');
            $table->dropColumn('shopify_order_id');
        });

        Schema::table('parties', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'shopify_customer_id']);
            $table->dropColumn('shopify_customer_id');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropIndex(['product_id', 'shopify_variant_id']);
            $table->dropIndex(['user_id', 'shopify_inventory_item_id']);
            $table->dropColumn(['shopify_variant_id', 'shopify_inventory_item_id']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'shopify_product_id']);
            $table->dropIndex(['user_id', 'shopify_inventory_item_id']);
            $table->dropColumn(['shopify_product_id', 'shopify_variant_id', 'shopify_inventory_item_id']);
        });
    }
};
