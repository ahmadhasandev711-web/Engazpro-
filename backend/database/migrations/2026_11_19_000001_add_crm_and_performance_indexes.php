<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('parties', function (Blueprint $table) {
            $table->string('crm_tier_override', 32)->nullable()->after('notes');
            $table->index(['user_id', 'type', 'crm_tier_override'], 'parties_user_type_tier_idx');
        });

        Schema::create('party_interactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('party_id')->constrained('parties')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('channel', 32);
            $table->text('notes');
            $table->timestamp('follow_up_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'party_id', 'created_at'], 'party_interactions_user_party_created_idx');
            $table->index(['user_id', 'follow_up_at'], 'party_interactions_user_followup_idx');
        });

        Schema::table('online_orders', function (Blueprint $table) {
            $table->index(['user_id', 'party_id', 'status'], 'online_orders_user_party_status_idx');
            $table->index(['user_id', 'customer_phone', 'status'], 'online_orders_user_phone_status_idx');
        });
    }

    public function down(): void
    {
        Schema::table('online_orders', function (Blueprint $table) {
            $table->dropIndex('online_orders_user_party_status_idx');
            $table->dropIndex('online_orders_user_phone_status_idx');
        });

        Schema::dropIfExists('party_interactions');

        Schema::table('parties', function (Blueprint $table) {
            $table->dropIndex('parties_user_type_tier_idx');
            $table->dropColumn('crm_tier_override');
        });
    }
};
