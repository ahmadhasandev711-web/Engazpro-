<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shopify_integrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('shop_domain');
            $table->string('auth_mode')->default('ACCESS_TOKEN');
            $table->text('access_token')->nullable();
            $table->string('client_id')->nullable();
            $table->text('client_secret')->nullable();
            $table->text('webhook_secret')->nullable();
            $table->foreignId('default_branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->boolean('auto_sync_stock')->default(true);
            $table->boolean('is_active')->default(false);
            $table->timestamp('token_expires_at')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->text('last_error')->nullable();
            $table->timestamps();

            $table->unique('user_id');
            $table->index('shop_domain');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shopify_integrations');
    }
};
