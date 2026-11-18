<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shopify_integrations', function (Blueprint $table) {
            $table->timestamp('webhook_registered_at')->nullable()->after('token_expires_at');
            $table->json('webhook_topics')->nullable()->after('webhook_registered_at');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->boolean('shopify_tracked')->default(true)->after('shopify_inventory_item_id');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->boolean('shopify_tracked')->default(true)->after('shopify_inventory_item_id');
        });

        Schema::table('online_orders', function (Blueprint $table) {
            $table->decimal('tax_total', 12, 2)->default(0)->after('discount_total');
        });
    }

    public function down(): void
    {
        Schema::table('shopify_integrations', function (Blueprint $table) {
            $table->dropColumn(['webhook_registered_at', 'webhook_topics']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('shopify_tracked');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropColumn('shopify_tracked');
        });

        Schema::table('online_orders', function (Blueprint $table) {
            $table->dropColumn('tax_total');
        });
    }
};
