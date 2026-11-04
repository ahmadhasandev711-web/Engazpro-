<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('woocommerce_integrations', function (Blueprint $table) {
            $table->string('anoofy_key_id', 26)->nullable()->unique()->after('online_branch_id');
            $table->text('anoofy_secret')->nullable()->after('anoofy_key_id');
            $table->string('anoofy_callback_url', 500)->nullable()->after('anoofy_secret');
            $table->timestamp('anoofy_connected_at')->nullable()->after('anoofy_callback_url');
        });

        Schema::table('wc_orders', function (Blueprint $table) {
            $table->timestamp('call_confirmed_at')->nullable()->after('status');
            $table->string('call_confirmed_by')->nullable()->after('call_confirmed_at');
            $table->unsignedInteger('anoofy_order_version')->default(0)->after('call_confirmed_by');
        });
    }

    public function down(): void
    {
        Schema::table('wc_orders', function (Blueprint $table) {
            $table->dropColumn(['call_confirmed_at', 'call_confirmed_by', 'anoofy_order_version']);
        });

        Schema::table('woocommerce_integrations', function (Blueprint $table) {
            $table->dropColumn(['anoofy_key_id', 'anoofy_secret', 'anoofy_callback_url', 'anoofy_connected_at']);
        });
    }
};
