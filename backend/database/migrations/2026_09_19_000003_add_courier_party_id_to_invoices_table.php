<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('courier_party_id')->nullable()->after('party_id')->constrained('parties')->nullOnDelete();
            $table->index(['user_id', 'courier_party_id']);
        });
    }

    public function down(): void
    {
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'courier_party_id']);
            $table->dropConstrainedForeignId('courier_party_id');
        });
    }
};
