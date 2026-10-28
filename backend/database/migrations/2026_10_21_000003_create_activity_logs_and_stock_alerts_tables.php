<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * سجل التدقيق (Audit Trail)
     */
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete()->comment('منفذ العملية');
            $table->unsignedBigInteger('account_id')->comment('معرف حساب المنشأة');
            $table->string('action')->comment('CREATED / UPDATED / DELETED');
            $table->string('subject_type')->comment('نوع الكائن المتأثر');
            $table->unsignedBigInteger('subject_id')->comment('معرف الكائن المتأثر');
            $table->text('description')->nullable();
            $table->json('properties')->nullable()->comment('قبل/بعد للحقول المتغيرة');
            $table->timestamps();

            $table->index(['account_id', 'created_at']);
            $table->index(['account_id', 'subject_type', 'subject_id']);
            $table->index(['account_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
