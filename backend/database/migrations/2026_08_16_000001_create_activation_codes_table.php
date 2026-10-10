<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * تشغيل الميجريشن: إنشاء جدول أكواد تفعيل الاشتراكات الآمنة
     */
    public function up(): void
    {
        Schema::create('activation_codes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 64)->unique(); // كود التفعيل المشفر والفريد
            $table->integer('duration_days')->default(365); // مدة التفعيل بالأيام (سنة افتراضياً)
            $table->string('plan')->default('BASIC'); // الخطة
            $table->boolean('is_used')->default(false); // حالة الاستخدام
            $table->foreignId('used_by_user_id')->nullable()->constrained('users')->nullOnDelete(); // المستخدم الذي قام بالتفعيل
            $table->timestamp('used_at')->nullable(); // وقت التفعيل بالثانية
            $table->string('batch_reference')->nullable(); // مرجع الدفعة
            $table->string('notes')->nullable(); // ملاحظات الأدمن
            $table->timestamps();

            $table->index(['code', 'is_used']);
        });
    }

    /**
     * التراجع عن الميجريشن
     */
    public function down(): void
    {
        Schema::dropIfExists('activation_codes');
    }
};
