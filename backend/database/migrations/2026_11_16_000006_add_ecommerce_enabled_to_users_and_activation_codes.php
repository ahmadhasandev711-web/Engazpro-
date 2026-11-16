<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('ecommerce_enabled')->default(false)->after('status');
        });

        Schema::table('activation_codes', function (Blueprint $table) {
            $table->boolean('ecommerce_enabled')->default(false)->after('price');
        });

        // Backfill existing merchants that already have an active WooCommerce or Shopify integration
        $wcOwnerIds = Schema::hasTable('woocommerce_integrations')
            ? DB::table('woocommerce_integrations')->where('is_active', true)->pluck('user_id')
            : collect();
        $shopifyOwnerIds = Schema::hasTable('shopify_integrations')
            ? DB::table('shopify_integrations')->where('is_active', true)->pluck('user_id')
            : collect();
        $activeIds = $wcOwnerIds->merge($shopifyOwnerIds)->unique()->values()->all();

        if (!empty($activeIds)) {
            DB::table('users')->whereIn('id', $activeIds)->whereNull('owner_id')->update(['ecommerce_enabled' => true]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('ecommerce_enabled');
        });

        Schema::table('activation_codes', function (Blueprint $table) {
            $table->dropColumn('ecommerce_enabled');
        });
    }
};
