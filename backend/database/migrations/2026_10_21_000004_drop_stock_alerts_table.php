<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * شطب ميزة تنبيهات المخزون (اعتمد فلتر النواقص في صفحة الأصناف بدلاً عنها)
     */
    public function up(): void
    {
        Schema::dropIfExists('stock_alerts');
    }

    public function down(): void
    {
        // لا تراجع — الميزة شطبت نهائياً
    }
};
