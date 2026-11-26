<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('easyorders_integrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('store_id', 64)->nullable();
            $table->string('store_name')->nullable();
            $table->string('auth_mode', 32)->default('API_KEY');
            $table->text('api_key')->nullable();
            $table->text('webhook_secret')->nullable();
            $table->foreignId('default_branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->boolean('auto_sync_stock')->default(true);
            $table->boolean('is_active')->default(false);
            $table->timestamp('webhook_registered_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'is_active'], 'eo_int_user_active_idx');
            $table->index('store_id', 'eo_int_store_id_idx');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('easyorders_product_id', 64)->nullable()->after('shopify_tracked');
            $table->string('easyorders_sku', 120)->nullable()->after('easyorders_product_id');
            $table->string('easyorders_taager_code', 120)->nullable()->after('easyorders_sku');

            $table->index(['user_id', 'easyorders_product_id'], 'products_user_eo_prod_idx');
            $table->index(['user_id', 'easyorders_sku'], 'products_user_eo_sku_idx');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->string('easyorders_variant_id', 64)->nullable()->after('shopify_tracked');
            $table->string('easyorders_taager_code', 120)->nullable()->after('easyorders_variant_id');

            $table->index(['user_id', 'easyorders_variant_id'], 'pv_user_eo_var_idx');
            $table->index(['user_id', 'easyorders_taager_code'], 'pv_user_eo_code_idx');
        });
    }

    public function down(): void
    {
        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropIndex('pv_user_eo_var_idx');
            $table->dropIndex('pv_user_eo_code_idx');
            $table->dropColumn(['easyorders_variant_id', 'easyorders_taager_code']);
        });

        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_user_eo_prod_idx');
            $table->dropIndex('products_user_eo_sku_idx');
            $table->dropColumn(['easyorders_product_id', 'easyorders_sku', 'easyorders_taager_code']);
        });

        Schema::dropIfExists('easyorders_integrations');
    }
};
