<?php

use App\Enums\PromotionSyncSource;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('woocommerce_integrations', function (Blueprint $table) {
            $table->boolean('auto_sync_prices')->default(false)->after('auto_sync_stock');
            $table->boolean('auto_sync_promotions')->default(false)->after('auto_sync_prices');
        });

        Schema::table('shopify_integrations', function (Blueprint $table) {
            $table->boolean('auto_sync_prices')->default(false)->after('auto_sync_stock');
            $table->boolean('auto_sync_promotions')->default(false)->after('auto_sync_prices');
        });

        Schema::table('promotions', function (Blueprint $table) {
            $table->unsignedBigInteger('wc_coupon_id')->nullable()->after('is_active');
            $table->string('shopify_discount_id', 128)->nullable()->after('wc_coupon_id');
            $table->string('sync_source', 32)->default(PromotionSyncSource::LOCAL->value)->after('shopify_discount_id');
            $table->boolean('sync_to_ecommerce')->default(true)->after('sync_source');
            $table->timestamp('last_synced_at')->nullable()->after('sync_to_ecommerce');
            $table->text('sync_error')->nullable()->after('last_synced_at');

            $table->index(['user_id', 'wc_coupon_id'], 'promotions_user_wc_coupon_idx');
            $table->index(['user_id', 'shopify_discount_id'], 'promotions_user_shopify_discount_idx');
        });
    }

    public function down(): void
    {
        Schema::table('promotions', function (Blueprint $table) {
            $table->dropIndex('promotions_user_wc_coupon_idx');
            $table->dropIndex('promotions_user_shopify_discount_idx');
            $table->dropColumn([
                'wc_coupon_id',
                'shopify_discount_id',
                'sync_source',
                'sync_to_ecommerce',
                'last_synced_at',
                'sync_error',
            ]);
        });

        Schema::table('shopify_integrations', function (Blueprint $table) {
            $table->dropColumn(['auto_sync_prices', 'auto_sync_promotions']);
        });

        Schema::table('woocommerce_integrations', function (Blueprint $table) {
            $table->dropColumn(['auto_sync_prices', 'auto_sync_promotions']);
        });
    }
};
