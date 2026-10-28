<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * منع سباقات ترقيم الفواتير: فك تشابك أي أرقام مكررة تاريخياً
     * ثم فرض تفرّد الرقم لكل حساب منشأة.
     */
    public function up(): void
    {
        $duplicates = DB::table('invoices as a')
            ->join('invoices as b', function ($join) {
                $join->on('a.user_id', '=', 'b.user_id')
                    ->on('a.invoice_number', '=', 'b.invoice_number')
                    ->whereColumn('a.id', '<', 'b.id');
            })
            ->select('b.id', 'b.invoice_number')
            ->orderBy('b.id')
            ->get();

        foreach ($duplicates as $row) {
            DB::table('invoices')
                ->where('id', $row->id)
                ->update(['invoice_number' => $row->invoice_number . '-DUP-' . $row->id]);
        }

        Schema::table('invoices', function (Blueprint $table) {
            $table->unique(['user_id', 'invoice_number'], 'invoices_user_id_invoice_number_unique');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropUnique('invoices_user_id_invoice_number_unique');
        });
    }
};
