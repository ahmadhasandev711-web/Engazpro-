<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('exchanges', function (Blueprint $table) {
            $table->index(['user_id', 'created_at'], 'idx_exchanges_user_created');
            $table->index(['user_id', 'branch_id', 'created_at'], 'idx_exchanges_user_branch_created');
        });
    }

    public function down(): void
    {
        Schema::table('exchanges', function (Blueprint $table) {
            $table->dropIndex('idx_exchanges_user_created');
            $table->dropIndex('idx_exchanges_user_branch_created');
        });
    }
};
