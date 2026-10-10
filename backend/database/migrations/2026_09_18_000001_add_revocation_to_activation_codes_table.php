<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * تشغيل الميجريشن: إضافة أعمدة الإلغاء والحرق لأكواد التفعيل
     */
    public function up(): void
    {
        Schema::table('activation_codes', function (Blueprint $table) {
            $table->boolean('is_revoked')->default(false)->after('is_used');
            $table->timestamp('revoked_at')->nullable()->after('used_at');
            $table->index(['is_revoked', 'is_used']);
        });
    }

    /**
     * التراجع عن الميجريشن
     */
    public function down(): void
    {
        Schema::table('activation_codes', function (Blueprint $table) {
            $table->dropIndex(['is_revoked', 'is_used']);
            $table->dropColumn(['is_revoked', 'revoked_at']);
        });
    }
};
