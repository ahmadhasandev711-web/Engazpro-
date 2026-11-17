<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('online_orders', function (Blueprint $table) {
            $table->string('call_status', 32)->nullable()->after('call_confirmed_by_user_id');
            $table->unsignedInteger('call_attempts_count')->default(0)->after('call_status');
            $table->timestamp('last_call_attempt_at')->nullable()->after('call_attempts_count');
            $table->string('last_call_attempt_by')->nullable()->after('last_call_attempt_at');
            $table->foreignId('last_call_attempt_by_user_id')->nullable()->after('last_call_attempt_by')
                ->constrained('users')->nullOnDelete();
            $table->timestamp('call_scheduled_at')->nullable()->after('last_call_attempt_by_user_id');
            $table->text('call_notes')->nullable()->after('call_scheduled_at');

            $table->string('cancel_reason', 64)->nullable()->after('notes');
            $table->text('cancel_notes')->nullable()->after('cancel_reason');
            $table->timestamp('cancelled_at')->nullable()->after('cancel_notes');
            $table->foreignId('cancelled_by_user_id')->nullable()->after('cancelled_at')
                ->constrained('users')->nullOnDelete();

            $table->index(['user_id', 'status', 'call_status'], 'online_orders_call_center_idx');
            $table->index(['user_id', 'call_scheduled_at'], 'online_orders_call_scheduled_idx');
        });
    }

    public function down(): void
    {
        Schema::table('online_orders', function (Blueprint $table) {
            $table->dropIndex('online_orders_call_center_idx');
            $table->dropIndex('online_orders_call_scheduled_idx');
            $table->dropConstrainedForeignId('last_call_attempt_by_user_id');
            $table->dropConstrainedForeignId('cancelled_by_user_id');
            $table->dropColumn([
                'call_status',
                'call_attempts_count',
                'last_call_attempt_at',
                'last_call_attempt_by',
                'call_scheduled_at',
                'call_notes',
                'cancel_reason',
                'cancel_notes',
                'cancelled_at',
            ]);
        });
    }
};
