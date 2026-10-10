<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wc_orders', function (Blueprint $table) {
            $table->string('shipping_type')->nullable()->after('mandob_id');
            $table->foreignId('courier_party_id')->nullable()->after('shipping_type')->constrained('parties')->nullOnDelete();
            $table->string('courier_name')->nullable()->after('courier_party_id');
            $table->string('tracking_number')->nullable()->after('courier_name');
            $table->timestamp('shipped_at')->nullable()->after('tracking_number');

            $table->index(['user_id', 'tracking_number']);
        });
    }

    public function down(): void
    {
        Schema::table('wc_orders', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'tracking_number']);
            $table->dropConstrainedForeignId('courier_party_id');
            $table->dropColumn([
                'shipping_type',
                'courier_name',
                'tracking_number',
                'shipped_at',
            ]);
        });
    }
};
