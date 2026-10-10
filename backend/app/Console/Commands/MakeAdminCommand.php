<?php

namespace App\Console\Commands;

use App\Models\Subscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Console\Command;

class MakeAdminCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'user:make-admin {identifier : The email or phone number of the user}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Promote a user to Super Admin and ensure active lifetime subscription';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $identifier = trim($this->argument('identifier'));

        $user = User::where('email', $identifier)
            ->orWhere('phone', $identifier)
            ->first();

        if (!$user) {
            $this->error("المستخدم المحدد ({$identifier}) غير موجود في قاعدة البيانات!");
            return self::FAILURE;
        }

        $user->is_admin = true;
        $user->save();

        // Ensure user has active subscription
        Subscription::updateOrCreate(
            ['user_id' => $user->id],
            [
                'start_date' => Carbon::today()->toDateString(),
                'end_date' => Carbon::today()->addYears(10)->toDateString(),
                'status' => 'ACTIVE',
                'plan' => 'ANNUAL',
                'price' => 0.00,
                'notes' => 'حساب مدير عام معتمد مدى الحياة',
            ]
        );

        $this->info("تمت ترقية المستخدم [{$user->name}] ({$user->email}) إلى مدير عام (Super Admin) بنجاح! 👑");

        return self::SUCCESS;
    }
}
