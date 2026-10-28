<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * إزالة سجل التدقيق بعد إيقاف الميزة.
     */
    public function up(): void
    {
        Schema::dropIfExists('activity_logs');
    }

    public function down(): void
    {
        // لا تُستعاد بيانات سجل التدقيق بعد حذفه.
    }
};
