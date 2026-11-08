<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('anoofy_outbox_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('event_id')->unique();
            $table->string('event_type', 50);
            $table->foreignId('wc_order_id')->constrained('wc_orders')->cascadeOnDelete();
            $table->unsignedInteger('order_version');
            $table->json('payload');
            $table->string('status', 30);
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->text('last_error')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('anoofy_outbox_events');
    }
};
