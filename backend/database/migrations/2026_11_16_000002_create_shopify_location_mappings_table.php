<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shopify_location_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('shopify_integration_id')->constrained('shopify_integrations')->cascadeOnDelete();
            $table->unsignedBigInteger('shopify_location_id');
            $table->string('shopify_location_name');
            $table->foreignId('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->boolean('auto_sync_stock')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['user_id', 'shopify_location_id'], 'shopify_loc_user_location_unique');
            $table->index(['branch_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shopify_location_mappings');
    }
};
