<?php

use App\Enums\StoreCreditTransactionType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('store_credit_transactions', function (Blueprint $table) {
            $table->decimal('remaining_amount', 12, 2)->nullable()->after('amount');
        });

        DB::table('store_credit_transactions')
            ->where('type', StoreCreditTransactionType::EARNED->value)
            ->update(['remaining_amount' => DB::raw('amount')]);
    }

    public function down(): void
    {
        Schema::table('store_credit_transactions', function (Blueprint $table) {
            $table->dropColumn('remaining_amount');
        });
    }
};
