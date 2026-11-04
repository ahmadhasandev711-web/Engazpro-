<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('anoofy_inbox_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('event_id');
            $table->string('event_type', 50);
            $table->unsignedInteger('order_version')->nullable();
            $table->string('result', 30);
            $table->string('reason')->nullable();
            $table->timestamp('received_at');
            $table->timestamps();

            $table->unique(['user_id', 'event_id']);
            $table->index(['user_id', 'received_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('anoofy_inbox_events');
    }
};
