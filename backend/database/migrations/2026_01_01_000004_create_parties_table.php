<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parties', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type'); // CUSTOMER, SUPPLIER
            $table->string('name')->index();
            $table->string('phone')->nullable()->index();
            $table->string('phone2')->nullable();
            $table->text('address')->nullable();
            $table->decimal('balance', 14, 2)->default(0.00);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['user_id', 'type']);
            $table->index(['user_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parties');
    }
};
