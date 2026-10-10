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
        $admin = User::where('email', 'ahmadhasandev711@gmail.com')
            ->orWhere('phone', '01125030642')
            ->first();

        if ($admin) {
            $admin->update([
                'name' => 'أحمد حسن (المدير العام)',
                'email' => 'ahmadhasandev711@gmail.com',
                'phone' => '01125030642',
                'password' => Hash::make('123456'),
                'is_admin' => true,
            ]);
        } else {
            $admin = User::create([
                'name' => 'أحمد حسن (المدير العام)',
                'email' => 'ahmadhasandev711@gmail.com',
                'phone' => '01125030642',
                'password' => Hash::make('123456'),
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
