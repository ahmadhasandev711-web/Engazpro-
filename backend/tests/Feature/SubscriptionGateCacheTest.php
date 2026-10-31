<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Branch;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SubscriptionGateCacheTest extends TestCase
{
    use RefreshDatabase;

    protected User $owner;
    protected User $employee;
    protected Subscription $subscription;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::create([
            'name' => 'مالك المتجر',
            'phone' => '01011112222',
            'password' => bcrypt('password123'),
            'role' => UserRole::OWNER,
            'status' => UserStatus::ACTIVE,
        ]);

        $this->subscription = Subscription::create([
            'user_id' => $this->owner->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'ANNUAL',
        ]);

        $this->employee = User::create([
            'owner_id' => $this->owner->id,
            'name' => 'كاشير المتجر',
            'phone' => '01033334444',
            'password' => bcrypt('password123'),
            'role' => UserRole::CASHIER,
            'status' => UserStatus::ACTIVE,
        ]);

        Branch::create([
            'user_id' => $this->owner->id,
            'name' => 'الفرع الرئيسي',
            'code' => 'B01',
            'is_main' => true,
        ]);
    }

    public function test_two_consecutive_requests_query_subscription_only_once(): void
    {
        $token = $this->employee->createToken('test')->plainTextToken;

        $subscriptionQueries = 0;
        DB::listen(function ($query) use (&$subscriptionQueries) {
            if (str_contains(strtolower($query->sql), 'subscriptions')) {
                $subscriptionQueries++;
            }
        });

        // الطلب الأول
        $this->app['auth']->forgetGuards();
        $res1 = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/branches');
        $res1->assertStatus(200);

        $this->assertSame(1, $subscriptionQueries, 'يجب استعلام جدول الاشتراكات مرة واحدة في الطلب الأول');

        // الطلب الثاني
        $this->app['auth']->forgetGuards();
        $res2 = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/branches');
        $res2->assertStatus(200);

        $this->assertSame(
            1,
            $subscriptionQueries,
            'الطلب الثاني يجب ألا ينفذ أي استعلام إضافي على جدول الاشتراكات بسبب الكاش'
        );
    }

    public function test_freezing_store_by_admin_invalidates_cache_immediately(): void
    {
        $token = $this->employee->createToken('test')->plainTextToken;

        // طلب أول لملء الكاش
        $this->app['auth']->forgetGuards();
        $res1 = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/branches');
        $res1->assertStatus(200);

        // تجميد حساب مالك المتجر من السوبر أدمن
        $this->owner->update(['status' => UserStatus::INACTIVE]);

        // موظف المتجر يرسل طلباً جديداً: يجب أن يحصل على 403 فوراً لمسح الكاش
        $this->app['auth']->forgetGuards();
        $res2 = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/branches');

        $res2->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'تم تجميد حساب المنشأة بالكامل من قبل إدارة المنصة. يرجى مراجعة إدارة المتجر.');
    }
}
