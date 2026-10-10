<?php

use App\Models\Party;
use App\Models\WcOrder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wc_orders', function (Blueprint $table) {
            $table->timestamp('order_date')->nullable()->after('wc_order_id');
            $table->index(['user_id', 'order_date']);
        });

        // 1. Backfill order_date with created_at for all existing orders
        DB::table('wc_orders')->whereNull('order_date')->update([
            'order_date' => DB::raw('created_at'),
        ]);

        // 2. Backfill missing customer phone and address from associated party
        $orders = WcOrder::whereNotNull('party_id')
            ->where(function ($q) {
                $q->whereNull('customer_phone')
                  ->orWhere('customer_phone', '')
                  ->orWhereNull('customer_address')
                  ->orWhere('customer_address', '');
            })
            ->with('party')
            ->get();

        foreach ($orders as $order) {
            $party = $order->party;
            if (!$party) {
                continue;
            }

            $updates = [];
            if (empty($order->customer_phone) && !empty($party->phone)) {
                $updates['customer_phone'] = $party->phone;
            }
            if (empty($order->customer_address) && !empty($party->address)) {
                $updates['customer_address'] = $party->address;
            }

            if (!empty($updates)) {
                $order->update($updates);
            }
        }
    }

    public function down(): void
    {
        Schema::table('wc_orders', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'order_date']);
            $table->dropColumn('order_date');
        });
    }
};
