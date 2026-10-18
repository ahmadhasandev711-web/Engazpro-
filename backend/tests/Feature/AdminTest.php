<?php

namespace Tests\Feature;

use App\Models\ActivationCode;
use App\Models\Subscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AdminTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $regularUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->adminUser = User::create([
            'name' => 'أحمد حسن (المدير العام)',
            'phone' => '01125030642',
            'email' => 'ahmadhasandev711@gmail.com',
            'password' => Hash::make('ahmadhasandev711@gmail.com'),
            'role' => 'OWNER',
            'status' => 'ACTIVE',
        ]);
        $this->adminUser->is_admin = true;
        $this->adminUser->save();

        $this->regularUser = User::create([
            'name' => 'تاجر عادي',
            'phone' => '01111111111',
            'email' => 'merchant@example.com',
            'password' => Hash::make('secret123'),
            'role' => 'OWNER',
            'status' => 'ACTIVE',
        ]);

        Subscription::create([
            'user_id' => $this->regularUser->id,
            'start_date' => Carbon::today()->toDateString(),
            'end_date' => Carbon::today()->addDays(7)->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'TRIAL',
            'price' => 0.00,
        ]);
    }

    public function test_admin_can_login_with_email_and_get_is_admin_flag(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'phone' => 'ahmadhasandev711@gmail.com',
            'password' => 'ahmadhasandev711@gmail.com',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
                'data' => [
                    'user' => [
                        'email' => 'ahmadhasandev711@gmail.com',
                        'is_admin' => true,
                    ],
                ],
            ]);
    }

    public function test_regular_user_cannot_access_admin_endpoints(): void
    {
        $response = $this->actingAs($this->regularUser)
            ->getJson('/api/admin/stats');

        $response->assertStatus(403);
    }

    public function test_admin_can_get_platform_stats(): void
    {
        $response = $this->actingAs($this->adminUser)
            ->getJson('/api/admin/stats');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'success',
                'data' => [
                    'users',
                    'subscriptions',
                    'licenses',
                    'activity',
                    'financials',
                ],
            ]);
    }

    public function test_admin_can_generate_licenses_in_batch(): void
    {
        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/admin/licenses/generate', [
                'count' => 5,
                'duration_days' => 365,
                'notes' => 'دفعة تجريبية للأدمن',
            ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertCount(5, $response->json('data'));
        $this->assertEquals(5, ActivationCode::where('is_used', false)->count());
    }

    public function test_admin_can_extend_user_subscription_directly(): void
    {
        $response = $this->actingAs($this->adminUser)
            ->postJson("/api/admin/users/{$this->regularUser->id}/extend", [
                'days' => 365,
                'notes' => 'تمديد استثنائي من الإدارة',
            ]);

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ]);

        $this->regularUser->refresh();
        $this->assertGreaterThan(300, $this->regularUser->subscription->days_remaining);
    }
}
