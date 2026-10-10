<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Table for store creation inquiries and leads from the landing page.
     */
    public function up(): void
    {
        Schema::create('store_inquiries', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->string('phone', 50)->index();
            $table->string('business_type', 100)->nullable();
            $table->string('city', 100)->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 30)->default('NEW')->index(); // NEW, CONTACTED, CONTRACTED, CLOSED
            $table->text('admin_notes')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('store_inquiries');
    }
};
