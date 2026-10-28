<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->index(['user_id', 'code'], 'products_user_id_code_index');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->index(['user_id', 'code'], 'product_variants_user_id_code_index');
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropIndex('products_user_id_code_index');
        });

        Schema::table('product_variants', function (Blueprint $table) {
            $table->dropIndex('product_variants_user_id_code_index');
        });
    }
};
