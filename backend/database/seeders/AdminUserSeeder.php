<?php

namespace Database\Seeders;

use App\Models\Subscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $name = config('pos.admin.name', 'مدير النظام');
        $email = config('pos.admin.email');
        $phone = config('pos.admin.phone');
        $password = config('pos.admin.password');

        if (empty($email) || empty($phone)) {
            throw new \RuntimeException('إعدادات حساب المدير العام غير مكتملة (يرجى ضبط ADMIN_EMAIL و ADMIN_PHONE في ملف .env).');
        }

        if (empty($password) || strlen($password) < 12) {
            throw new \RuntimeException('كلمة مرور حساب المدير العام غير آمنة أو غير مضبوطة (يجب ألا تقل عن 12 حرفاً، يرجى ضبط ADMIN_PASSWORD في ملف .env).');
        }

        $admin = User::where('email', $email)
            ->orWhere('phone', $phone)
            ->first();

        if ($admin) {
            $admin->update([
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'password' => Hash::make($password),
                'is_admin' => true,
            ]);
        } else {
            $admin = User::create([
                'name' => $name,
                'email' => $email,
                'phone' => $phone,
                'password' => Hash::make($password),
                'is_admin' => true,
            ]);
        }

        // Ensure Admin has a valid lifetime subscription as well
        Subscription::updateOrCreate(
            ['user_id' => $admin->id],
            [
                'start_date' => Carbon::today()->toDateString(),
                'end_date' => Carbon::today()->addYears(10)->toDateString(),
                'status' => 'ACTIVE',
                'plan' => 'ANNUAL',
                'price' => 0.00,
                'notes' => 'حساب المدير العام مدى الحياة',
            ]
        );

        // Ensure Admin has default branch, treasuries, cash customer, and sample product
        app(\App\Services\StoreBootstrapService::class)->bootstrapNewStore($admin);
    }
}
