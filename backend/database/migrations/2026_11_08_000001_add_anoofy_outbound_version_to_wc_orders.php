<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wc_orders', function (Blueprint $table) {
            $table->unsignedInteger('anoofy_outbound_version')->default(0)->after('anoofy_order_version');
        });
    }

    public function down(): void
    {
        Schema::table('wc_orders', function (Blueprint $table) {
            $table->dropColumn('anoofy_outbound_version');
        });
    }
};
