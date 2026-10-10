<?php

namespace Tests\Feature;

use App\Models\Subscription;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthAndSubscriptionTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register_and_receives_active_subscription(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'أحمد المندوب',
            'phone' => '01012345678',
            'password' => 'secret123',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'success',
                'message',
                'data' => [
                    'user' => ['id', 'name', 'phone', 'subscription'],
                    'token',
                ],
            ]);

        $this->assertDatabaseHas('users', ['phone' => '01012345678']);
        $this->assertDatabaseHas('subscriptions', [
            'status' => 'ACTIVE',
            'plan' => 'TRIAL',
        ]);
    }

    public function test_user_can_login_with_valid_credentials(): void
    {
        $user = User::create([
            'name' => 'تاجر تجريبي',
            'phone' => '01099999999',
            'password' => bcrypt('password123'),
        ]);

        Subscription::create([
            'user_id' => $user->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $response = $this->postJson('/api/auth/login', [
            'phone' => '01099999999',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => ['user', 'token'],
            ]);
    }

    public function test_user_cannot_login_with_wrong_password(): void
    {
        User::create([
            'name' => 'تاجر تجريبي',
            'phone' => '01099999999',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'phone' => '01099999999',
            'password' => 'wrong_password',
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('success', false);
    }

    public function test_authenticated_user_can_get_profile_and_subscription_status(): void
    {
        $user = User::create([
            'name' => 'تاجر 1',
            'phone' => '01088888888',
            'password' => bcrypt('password123'),
        ]);

        $sub = Subscription::create([
            'user_id' => $user->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
            'status' => 'ACTIVE',
            'plan' => 'BASIC',
        ]);

        $token = $user->createToken('test_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/auth/me');

        $response->assertStatus(200)
            ->assertJsonPath('data.phone', '01088888888');

        $subResponse = $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/subscription/status');

        $subResponse->assertStatus(200)
            ->assertJsonPath('data.status', 'ACTIVE')
            ->assertJsonPath('data.is_valid', true);
    }

    public function test_user_can_renew_subscription_with_activation_code(): void
    {
        $user = User::create([
            'name' => 'تاجر 1',
            'phone' => '01077777777',
            'password' => bcrypt('password123'),
        ]);

        // اشتراك منتهي
        Subscription::create([
            'user_id' => $user->id,
            'start_date' => now()->subYear()->toDateString(),
            'end_date' => now()->subMonth()->toDateString(),
            'status' => 'EXPIRED',
            'plan' => 'BASIC',
        ]);

        $code = \App\Models\ActivationCode::create([
            'code' => 'KASH-RENEW-1111',
            'duration_days' => 365,
            'plan' => 'BASIC',
            'is_used' => false,
        ]);

        $token = $user->createToken('test_token')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer {$token}")
            ->postJson('/api/subscription/activate-code', [
                'code' => 'KASH-RENEW-1111',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.subscription.status', 'ACTIVE');
    }
}
