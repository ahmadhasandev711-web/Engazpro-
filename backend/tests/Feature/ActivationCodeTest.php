<?php

namespace Tests\Feature;

use App\Models\ActivationCode;
use App\Models\Subscription;
use App\Models\User;
use App\Services\ActivationCodeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivationCodeTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_activate_subscription_with_valid_code(): void
    {
        $user = User::create([
            'name' => 'تاجر كاشات',
            'phone' => '01011112222',
            'password' => bcrypt('password123'),
        ]);
        $token = $user->createToken('auth')->plainTextToken;

        // إنشاء كود صالح لسنة (365 يوم)
        $code = ActivationCode::create([
            'code' => 'KASH-TEST-1234-5678',
            'duration_days' => 365,
            'plan' => 'BASIC',
            'is_used' => false,
        ]);

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/subscription/activate-code', [
                'code' => 'kash-test-1234-5678', // Case insensitive test
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.duration_days', 365);

        $this->assertDatabaseHas('activation_codes', [
            'id' => $code->id,
            'is_used' => true,
            'used_by_user_id' => $user->id,
        ]);

        $this->assertDatabaseHas('subscriptions', [
            'user_id' => $user->id,
            'status' => 'ACTIVE',
        ]);
    }

    public function test_same_activation_code_cannot_be_used_twice_strict_guard(): void
    {
        $user1 = User::create([
            'name' => 'تاجر 1',
            'phone' => '01033334444',
            'password' => bcrypt('password123'),
        ]);
        $user2 = User::create([
            'name' => 'تاجر 2',
            'phone' => '01055556666',
            'password' => bcrypt('password123'),
        ]);

        $token1 = $user1->createToken('auth')->plainTextToken;
        $token2 = $user2->createToken('auth')->plainTextToken;

        // توليد كود عبر السيرفس
        $service = app(ActivationCodeService::class);
        $codes = $service->generateCodes(1, 365);
        $testCode = $codes[0]->code;

        // المستخدم الأول يفعل الكود
        $res1 = $this->withHeader('Authorization', 'Bearer ' . $token1)
            ->postJson('/api/subscription/activate-code', [
                'code' => $testCode,
            ]);
        $res1->assertStatus(200);

        // المستخدم الثاني يحاول استخدام نفس الكود -> يجب أن يُرفض فوراً 422
        $res2 = $this->withHeader('Authorization', 'Bearer ' . $token2)
            ->postJson('/api/subscription/activate-code', [
                'code' => $testCode,
            ]);

        $res2->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }

    public function test_invalid_activation_code_fails(): void
    {
        $user = User::create([
            'name' => 'تاجر 3',
            'phone' => '01077778888',
            'password' => bcrypt('password123'),
        ]);
        $token = $user->createToken('auth')->plainTextToken;

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/subscription/activate-code', [
                'code' => 'INVALID-CODE-9999',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['code']);
    }
}
